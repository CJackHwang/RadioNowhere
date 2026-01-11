/**
 * TTS Agent - Gemini Flash Lite TTS 语音合成
 * 管理语音生成队列，自动重试失败请求
 */

import { getSettings } from '../settings_store';
import { buildVertexUrl, apiFetch } from '../ai_service';
import {
    TTSRequest,
    TTSResult,
    VOICE_PROFILES,
    SpeakerId,
    MoodType
} from '../types/radio_types';
import { radioMonitor } from '../radio_monitor';
import { getMicrosoftFullVoiceName } from '../voice_provider';

// ================== Constants ==================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ================== Style Prompt Builder ==================

/**
 * 角色详细配置（通用模板，不绑定具体名字）
 */
const CHARACTER_PROFILES: Record<string, {
    name: string;
    role: string;
    personality: string;
    accent: string;
    scene: string;
}> = {
    host1: {
        name: '女主持人',
        role: '电台女主持人',
        personality: '温柔知性，声音清澈，带着让人放松的治愈感',
        accent: '标准普通话，自然流畅',
        scene: '电台直播间，柔和的灯光，轻松的氛围'
    },
    host2: {
        name: '男主持人',
        role: '电台男主持人',
        personality: '阳光开朗，声音有磁性，幽默风趣又不失专业',
        accent: '标准普通话，清晰利落',
        scene: '电台直播间，与搭档主持，气氛轻松愉快'
    },
    guest: {
        name: '嘉宾',
        role: '电台访谈嘉宾',
        personality: '专业、有见解，说话有条理',
        accent: '标准普通话',
        scene: '电台访谈室，接受采访'
    },
    news: {
        name: '新闻播报员',
        role: '整点新闻播报员',
        personality: '专业稳重，客观中立',
        accent: '标准新闻播音腔',
        scene: '新闻直播间，正式的播报环境'
    },
    announcer: {
        name: '报时员',
        role: '整点报时播报员',
        personality: '专业严肃，声音沉稳有力',
        accent: '标准播音腔，清晰准确',
        scene: '电台报时间隙，庄重的报时环境'
    }
};

/**
 * 构建 TTS 风格提示（Google 官方推荐结构）
 * 
 * 结构：
 * 1. AUDIO PROFILE - 角色身份和原型
 * 2. THE SCENE - 场景和氛围
 * 3. DIRECTOR'S NOTES - 风格、节奏、口音指导
 */
export function buildStylePrompt(
    speaker: SpeakerId,
    mood?: MoodType,
    customStyle?: string
): string {
    const profile = VOICE_PROFILES[speaker];
    const character = CHARACTER_PROFILES[speaker] || CHARACTER_PROFILES.host1;

    const moodDescriptions: Record<MoodType, string> = {
        cheerful: '开朗愉快，带着微笑的语气，让听众感到快乐',
        calm: '平静舒缓，像轻柔的夜风，让人感到放松',
        excited: '兴奋激动，语速略快，充满热情和感染力',
        serious: '严肃认真，专业可信，语调沉稳',
        warm: '温暖亲切，像老朋友一样，充满关怀',
        playful: '俏皮活泼，带点调侃，语调上扬',
        melancholy: '略带忧郁，深情款款，声音轻柔',
        mysterious: '神秘莫测，引人入胜，语速放慢'
    };

    let prompt = `# AUDIO PROFILE: ${character.name}
## "${character.role}"

${character.personality}

## THE SCENE: 深夜电台直播间
${character.scene}。红色的 "ON AIR" 指示灯亮着，话筒前的主持人正准备开口。

### DIRECTOR'S NOTES
Style: ${profile.style}`;

    if (mood) {
        prompt += `
Mood: ${moodDescriptions[mood]}`;
    }

    prompt += `
Pacing: 适中舒缓，像深夜电台主持人一样，不急不慢
Accent: ${character.accent}`;

    if (customStyle) {
        prompt += `
Special Instructions: ${customStyle}`;
    }

    prompt += `

### PERFORMANCE GUIDANCE
- 声音要有"微笑感"，让听众感受到温暖
- 语调自然起伏，避免机械朗读
- 适当停顿，让内容更有节奏感`;

    return prompt;
}

// ================== TTS Agent Class ==================

import { Cast, CastMember } from '../cast_system';

const MAX_CONCURRENT = 5; // 最大并发数

export class TTSAgent {
    private queue: TTSRequest[] = [];
    private cache: Map<string, ArrayBuffer> = new Map();
    private activeCast: Cast | null = null;
    private activeRequests = 0; // 当前并发数
    private waitingQueue: Array<() => void> = []; // 等待队列
    private abortController: AbortController | null = null; // 用于中止请求
    private isAborted = false; // 中止标志

    /**
     * 获取并发槽位（最多 5 个并发）
     */
    private async acquireSlot(): Promise<void> {
        if (this.activeRequests < MAX_CONCURRENT) {
            this.activeRequests++;
            return;
        }
        // 排队等待
        return new Promise(resolve => {
            this.waitingQueue.push(resolve);
        });
    }

    /**
     * 释放并发槽位
     */
    private releaseSlot(): void {
        if (this.waitingQueue.length > 0) {
            // 唤醒下一个等待的请求
            const next = this.waitingQueue.shift();
            next?.();
        } else {
            this.activeRequests--;
        }
    }

    /**
     * 设置当前演员阵容
     */
    setActiveCast(cast: Cast): void {
        this.activeCast = cast;
    }

    /**
     * 中止所有进行中的请求
     */
    abort(): void {
        this.isAborted = true;
        // 中止正在进行的 fetch 请求
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        // 清空等待队列
        this.waitingQueue.forEach(resolve => resolve());
        this.waitingQueue = [];
        this.activeRequests = 0;
        // 重置状态
        radioMonitor.updateStatus('TTS', 'IDLE', 'Aborted');
    }

    /**
     * 重置中止状态（启动新会话时调用）
     */
    reset(): void {
        this.isAborted = false;
        this.abortController = null;
        this.waitingQueue = [];
        this.activeRequests = 0;
    }

    /**
     * 根据 speaker ID 获取音色
     */
    private getVoiceForSpeaker(speaker: SpeakerId | string): { voiceName: string; description: string } {
        // 1. 先从当前演员阵容查找
        if (this.activeCast) {
            const member = this.activeCast.members.find(m => m.roleId === speaker);
            if (member) {
                return {
                    voiceName: member.voiceName,
                    description: `${member.roleName}: ${member.personality}`
                };
            }
        }

        // 2. 回退到预设配置
        const profile = VOICE_PROFILES[speaker as SpeakerId];
        if (profile) {
            return {
                voiceName: profile.voiceName,
                description: profile.description
            };
        }

        // 3. 默认音色
        return {
            voiceName: 'Aoede',
            description: '默认音色'
        };
    }

    /**
     * 添加 TTS 请求到队列
     */
    async addToQueue(request: TTSRequest): Promise<TTSResult> {
        // 检查缓存
        const cacheKey = this.getCacheKey(request);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            radioMonitor.log('TTS', `Cache Hit: ${request.text.slice(0, 20)}...`, 'trace');
            return {
                id: request.id,
                success: true,
                audioData: cached
            };
        }

        // 记录队列状态
        radioMonitor.updateStatus('TTS', 'BUSY', `Processing: ${request.text.slice(0, 15)}...`);

        // 直接处理请求（队列仅用于状态跟踪）
        return this.processRequest(request);
    }

    /**
     * 生成 TTS 音频
     */
    async generateSpeech(
        text: string,
        speaker: SpeakerId | string,
        options?: {
            mood?: MoodType;
            customStyle?: string;
            priority?: number;
            voiceName?: string;  // AI 指定的音色名（优先使用）
        }
    ): Promise<TTSResult> {
        // 优先使用 AI 指定的音色名，否则通过 speaker 映射
        const voiceInfo = this.getVoiceForSpeaker(speaker);
        const finalVoiceName = options?.voiceName || voiceInfo.voiceName;

        // 使用增强的提示词构建器（仅对标准角色有效）
        const speakerId = ['host1', 'host2', 'guest', 'news'].includes(speaker)
            ? speaker as SpeakerId
            : 'host1';
        const stylePrompt = buildStylePrompt(speakerId, options?.mood, options?.customStyle);

        const request: TTSRequest = {
            id: `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text,
            voiceName: finalVoiceName,
            stylePrompt,
            priority: options?.priority || 5
        };

        return this.addToQueue(request);
    }

    /**
     * 多说话人 TTS 生成（Gemini 专用）
     * 支持最多 2 个说话人的连续对话合并
     */
    async generateMultiSpeakerSpeech(
        scripts: Array<{
            speaker: string;
            text: string;
            voiceName?: string;
            mood?: MoodType;
        }>
    ): Promise<TTSResult> {
        const settings = getSettings();

        // 微软 TTS 不支持多说话人，降级为单独处理
        if (settings.ttsProvider === 'microsoft') {
            radioMonitor.log('TTS', 'Microsoft TTS 不支持多说话人，降级为单独处理', 'warn');
            // 返回第一句的处理结果
            if (scripts.length > 0) {
                return this.generateSpeech(scripts[0].text, scripts[0].speaker as SpeakerId, {
                    voiceName: scripts[0].voiceName,
                    mood: scripts[0].mood
                });
            }
            return { id: 'empty', success: false, error: 'No scripts provided' };
        }

        // 收集唯一说话人（最多2个）
        const speakerMap = new Map<string, string>();
        for (const script of scripts) {
            if (speakerMap.size >= 2) break;
            if (!speakerMap.has(script.speaker)) {
                const voiceInfo = this.getVoiceForSpeaker(script.speaker);
                speakerMap.set(script.speaker, script.voiceName || voiceInfo.voiceName);
            }
        }

        // 构建对话文本
        const conversationText = scripts
            .map(s => `${s.speaker}: ${s.text}`)
            .join('\n');

        // 构建多说话人配置
        const speakerVoiceConfigs = Array.from(speakerMap.entries()).map(([speaker, voiceName]) => ({
            speaker,
            voiceConfig: {
                prebuiltVoiceConfig: {
                    voiceName
                }
            }
        }));

        radioMonitor.updateStatus('TTS', 'BUSY', `Multi-speaker: ${scripts.length} lines`);
        radioMonitor.log('TTS', `Gemini 多说话人 TTS: ${speakerMap.size} 人, ${scripts.length} 句`, 'info');

        try {
            const audioData = await this.callGeminiMultiSpeakerApi(conversationText, speakerVoiceConfigs);
            return {
                id: `multi-${Date.now()}`,
                success: true,
                audioData
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            radioMonitor.log('TTS', `Multi-speaker TTS failed: ${errorMsg}`, 'error');
            return {
                id: `multi-${Date.now()}`,
                success: false,
                error: errorMsg
            };
        }
    }

    /**
     * Gemini 多说话人 API 调用
     */
    private async callGeminiMultiSpeakerApi(
        conversationText: string,
        speakerVoiceConfigs: Array<{
            speaker: string;
            voiceConfig: { prebuiltVoiceConfig: { voiceName: string } };
        }>
    ): Promise<ArrayBuffer> {
        const settings = getSettings();
        const ttsApiKey = settings.ttsApiKey || settings.apiKey;
        const ttsModel = settings.ttsModel || 'gemini-2.5-flash-preview-tts';

        const baseEndpoint = settings.ttsEndpoint?.trim()
            || 'https://generativelanguage.googleapis.com';
        const normalizedEndpoint = baseEndpoint.replace(/\/$/, '');

        const prompt = `TTS the following conversation:\n${conversationText}`;

        const body = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs
                    }
                }
            }
        };

        const apiUrl = `${normalizedEndpoint}/v1beta/models/${ttsModel}:generateContent?key=${ttsApiKey}`;

        this.abortController = new AbortController();
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: this.abortController.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini Multi-Speaker TTS Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!audioBase64) {
            throw new Error('No audio data in response');
        }

        // Base64 -> ArrayBuffer
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * 处理单个请求（最多 5 个并发）
     */
    private async processRequest(request: TTSRequest): Promise<TTSResult> {
        const retryCount = request.retryCount || 0;

        // 获取并发槽位（超过 5 个则排队等待）
        await this.acquireSlot();

        try {
            radioMonitor.updateStatus('TTS', 'BUSY', `Generating: ${request.text.slice(0, 15)}...`);
            const audioData = await this.callTTSApi(request);

            // 缓存结果
            const cacheKey = this.getCacheKey(request);
            this.cache.set(cacheKey, audioData);

            radioMonitor.updateStatus('TTS', 'READY', `Generated: ${request.text.slice(0, 10)}`);
            // 成功：释放槽位并返回
            this.releaseSlot();
            return {
                id: request.id,
                success: true,
                audioData
            };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            // 检查是否是中止信号导致的错误（静默处理）
            if (errorMsg.includes('abort') || errorMsg.includes('Abort') || this.isAborted) {
                console.log('[TTS] Request aborted (expected during disconnect)');
                this.releaseSlot();
                return {
                    id: request.id,
                    success: false,
                    error: 'Aborted'
                };
            }

            console.error(`TTS Error (attempt ${retryCount + 1}):`, errorMsg);

            // 检查是否是网络错误或临时性错误（可重试）
            const isRetryableError = errorMsg.includes('Failed to fetch') ||
                errorMsg.includes('network') ||
                errorMsg.includes('ECONNREFUSED') ||
                errorMsg.includes('socket') ||
                errorMsg.includes('No audio data') ||
                errorMsg.includes('503') ||
                errorMsg.includes('NO_KEYS_AVAILABLE');
            if (isRetryableError && retryCount < MAX_RETRIES) {
                // 503 错误需要更长的延迟
                const delay = errorMsg.includes('503') || errorMsg.includes('NO_KEYS_AVAILABLE')
                    ? RETRY_DELAY_MS * (retryCount + 1) * 3  // 503: 3秒、6秒、9秒
                    : RETRY_DELAY_MS * (retryCount + 1);
                radioMonitor.updateStatus('TTS', 'BUSY', `Retrying in ${delay / 1000}s...`);
                this.releaseSlot();
                await this.delay(delay);
                request.retryCount = retryCount + 1;
                return this.processRequest(request);
            }

            // 检查是否是 429 限流错误
            if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
                // 提取 retry-after 时间，默认 45 秒
                const retryMatch = errorMsg.match(/retry in (\d+)/i);
                const retryDelay = retryMatch ? parseInt(retryMatch[1]) * 1000 + 2000 : 47000;
                console.log(`[TTS] Rate limited, retrying in ${retryDelay}ms...`);
                // 释放槽位再重试
                this.releaseSlot();
                await this.delay(retryDelay);
                request.retryCount = retryCount + 1;
                return this.processRequest(request);
            }

            if (retryCount < MAX_RETRIES) {
                // 普通重试：释放槽位再重试
                radioMonitor.updateStatus('TTS', 'BUSY', `Retrying (attempt ${retryCount + 1})...`);
                this.releaseSlot();
                await this.delay(RETRY_DELAY_MS * (retryCount + 1));
                request.retryCount = retryCount + 1;
                return this.processRequest(request);
            }

            // 失败时释放槽位
            this.releaseSlot();
            return {
                id: request.id,
                success: false,
                error: `TTS 生成失败: ${errorMsg}`
            };
        }
    }

    /**
     * 调用 TTS API（根据 ttsProvider 分发）
     */
    private async callTTSApi(request: TTSRequest): Promise<ArrayBuffer> {
        const settings = getSettings();

        if (settings.ttsProvider === 'microsoft') {
            return this.callMicrosoftTTSApi(request.text, request.voiceName);
        }

        // Gemini TTS 调用逻辑
        return this.callGeminiTTSApi(request);
    }

    /**
     * 调用 Microsoft TTS API
     * API 格式: GET /api/text-to-speech?voice=...&volume=...&rate=...&pitch=...&text=...
     * Token: 优先使用自定义 token，留空则使用内置 token
     */
    private async callMicrosoftTTSApi(text: string, voiceName: string): Promise<ArrayBuffer> {
        const settings = getSettings();

        const endpoint = (settings.msTtsEndpoint || 'https://tts.cjack.top').replace(/\/$/, '');

        // 获取 Microsoft 音色完整名称（支持直接指定或映射）
        const msVoice = this.getMicrosoftVoiceName(voiceName);
        const voice = encodeURIComponent(msVoice);

        // 过滤掉舞台指令和描述文本 (括号内容)
        const cleanText = this.filterStageDirections(text);
        if (!cleanText.trim()) {
            // 如果过滤后为空，返回静音
            throw new Error('No text to speak after filtering stage directions');
        }
        const encodedText = encodeURIComponent(cleanText);

        const url = `${endpoint}/api/text-to-speech?` +
            `voice=${voice}&volume=100&rate=0&pitch=0&text=${encodedText}`;

        // 优先使用自定义 token，留空则使用内置 token
        const token = settings.msTtsAuthKey || 'tetr5354';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`
        };

        radioMonitor.updateStatus('TTS', 'BUSY', `Microsoft TTS: ${cleanText.slice(0, 15)}...`);
        radioMonitor.log('TTS', `Microsoft TTS [${msVoice.match(/\(([^)]+)\)/)?.[1] || 'Unknown'}]: ${cleanText.slice(0, 20)}...`, 'info');

        // 创建 AbortController 用于中止请求
        this.abortController = new AbortController();
        const response = await fetch(url, { headers, signal: this.abortController.signal });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Microsoft TTS Error: ${response.status} - ${errorText}`);
        }

        return response.arrayBuffer();
    }

    /**
     * 过滤舞台指令和描述文本
     * 移除 (音乐声渐弱)、【旁白】 等内容
     */
    private filterStageDirections(text: string): string {
        return text
            // 移除中文括号内容 (舞台指令)
            .replace(/（[^）]*）/g, '')
            // 移除英文括号内容
            .replace(/\([^)]*\)/g, '')
            // 移除方括号内容 [旁白]
            .replace(/\[[^\]]*\]/g, '')
            // 移除中文方括号内容 【旁白】
            .replace(/【[^】]*】/g, '')
            // 清理多余空白
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * 获取 Microsoft TTS 完整音色名称
     * 直接使用 AI 选择的微软音色名
     */
    private getMicrosoftVoiceName(voiceName: string): string {
        // 1. 如果已经是完整的微软格式，直接返回
        if (voiceName.includes('Microsoft Server Speech')) {
            return voiceName;
        }

        // 2. 使用 voice_provider 查找微软音色完整名称
        return getMicrosoftFullVoiceName(voiceName);
    }

    /**
     * 调用 Gemini TTS API
     */
    private async callGeminiTTSApi(request: TTSRequest): Promise<ArrayBuffer> {
        const settings = getSettings();

        // 使用 TTS 专用配置，如果没有设置则使用主配置
        const ttsApiKey = settings.ttsApiKey || settings.apiKey;
        const ttsModel = settings.ttsModel || 'gemini-2.5-flash-preview-tts';

        // 自定义 Endpoint 或使用官方
        const baseEndpoint = settings.ttsEndpoint?.trim()
            || 'https://generativelanguage.googleapis.com';
        const normalizedEndpoint = baseEndpoint.replace(/\/$/, '');

        // 构建完整的 TTS 提示
        const fullPrompt = `${request.stylePrompt}

#### TRANSCRIPT
${request.text}`;

        const body = {
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: request.voiceName
                        }
                    }
                }
            }
        };

        let response: Response;

        if (settings.apiType === 'vertexai' && settings.ttsUseVertex) {
            // 使用 Vertex AI 配置
            const isGcpApiKey = settings.apiKey.startsWith('AIza');
            const apiUrl = buildVertexUrl(
                settings.gcpProject,
                settings.gcpLocation,
                ttsModel,
                'generateContent'
            ) + (isGcpApiKey ? `?key=${settings.apiKey}` : '');

            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (!isGcpApiKey) {
                headers['Authorization'] = `Bearer ${settings.apiKey}`;
            }

            response = await apiFetch(apiUrl, {
                method: 'POST',
                headers,
                body
            });
        } else {
            // 使用 Gemini Native (AI Studio) 配置
            const apiUrl = `${normalizedEndpoint}/v1beta/models/${ttsModel}:generateContent?key=${ttsApiKey}`;
            response = await apiFetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // 提取音频数据
        const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioBase64) {
            throw new Error('No audio data in response');
        }

        // Base64 转 ArrayBuffer
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return bytes.buffer;
    }



    /**
     * 获取缓存键
     */
    private getCacheKey(request: TTSRequest): string {
        return `${request.text}|${request.voiceName}|${request.stylePrompt}`;
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * 获取队列状态
     */
    getQueueStatus(): { pending: number; cacheSize: number } {
        return {
            pending: this.queue.length,
            cacheSize: this.cache.size
        };
    }
}

// 单例导出
export const ttsAgent = new TTSAgent();
