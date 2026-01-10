/**
 * Writer Agent - 编剧 Agent
 * 根据导演指令生成节目台本，选择主持人、设置语气
 */

import { getSettings } from '../settings_store';
import {
    ShowTimeline,
    TimelineBlock,
} from '../types/radio_types';
import { globalState } from '../global_state';
import { radioMonitor } from '../radio_monitor';

// ================== Constants ==================

const MAX_PARSE_RETRIES = 3;

// ================== Radio Setting (Dynamic) ==================

function getRadioSetting(): string {
    const now = new Date();
    const hour = now.getHours();

    // 根据时段选择电台风格
    let stationName = '';
    let positioning = '';
    let style = '';
    let host1Desc = '';
    let host2Desc = '';

    if (hour >= 6 && hour < 9) {
        stationName = '「晨光电台」';
        positioning = '元气早间节目，开启美好一天';
        style = '轻快活力、正能量、元气满满';
        host1Desc = 'host1 (晨曦)：女，活力开朗，擅长分享生活小确幸';
        host2Desc = 'host2 (阿明)：男，阳光幽默，擅长讲冷笑话叫醒听众';
    } else if (hour >= 9 && hour < 12) {
        stationName = '「工作伴侣」';
        positioning = '工作时段背景音乐台，提升效率';
        style = '轻松不打扰、专注氛围、偶尔分享小知识';
        host1Desc = 'host1 (静雯)：女，知性温和，分享工作效率技巧';
        host2Desc = 'host2 (大卫)：男，沉稳专业，推荐适合工作的音乐';
    } else if (hour >= 12 && hour < 14) {
        stationName = '「午间慢时光」';
        positioning = '午休陪伴电台，放松身心';
        style = '慵懒惬意、轻松聊天、午后小憩感';
        host1Desc = 'host1 (小悠)：女，慵懒甜美，聊美食和生活';
        host2Desc = 'host2 (懒懒)：男，随性幽默，分享有趣见闻';
    } else if (hour >= 14 && hour < 18) {
        stationName = '「下午茶电台」';
        positioning = '午后音乐时光，陪伴下午时光';
        style = '文艺清新、下午茶氛围、indie 音乐';
        host1Desc = 'host1 (茶茶)：女，文艺范，聊书籍和电影';
        host2Desc = 'host2 (阿木)：男，音乐达人，推荐小众好歌';
    } else if (hour >= 18 && hour < 21) {
        stationName = '「晚风电台」';
        positioning = '傍晚归家陪伴，温情时刻';
        style = '温情脉脉、下班放松、都市情感';
        host1Desc = 'host1 (晚晚)：女，温柔体贴，聊情感和生活';
        host2Desc = 'host2 (风子)：男，成熟稳重，分享人生感悟';
    } else if (hour >= 21 || hour < 2) {
        stationName = '「深夜电波」';
        positioning = '陪伴型深夜电台，温暖治愈';
        style = '轻松温馨、偶尔搞笑、深夜陪伴感';
        host1Desc = 'host1 (阿静)：女，温柔知性，擅长情感话题';
        host2Desc = 'host2 (小北)：男，幽默随和，擅长音乐推荐';
    } else {
        stationName = '「凌晨守夜人」';
        positioning = '失眠者的陪伴，安静助眠';
        style = '轻声细语、助眠氛围、温柔陪伴';
        host1Desc = 'host1 (梦梦)：女，轻柔舒缓，讲睡前故事';
        host2Desc = 'host2 (星辰)：男，低沉磁性，推荐轻音乐';
    }

    return `你是一个现代中文网络电台的节目编排AI。

电台名称：${stationName}
定位：${positioning}

常驻主持人：
- ${host1Desc}
- ${host2Desc}

节目风格：${style}
`;
}

// ================== Writer Agent Class ==================

import { Cast, castDirector, ShowType } from '../cast_system';

export class WriterAgent {
    private currentCast: Cast | null = null;

    /**
     * 获取当前演员阵容
     */
    getCurrentCast(): Cast | null {
        return this.currentCast;
    }

    /**
     * 生成节目时间线
     * @param duration 目标时长（秒），默认 120 秒（2分钟）
     * @param theme 节目主题（可选）
     * @param userRequest 用户投稿内容（可选）
     * @param showType 指定节目类型（可选，不指定则随机）
     */
    async generateTimeline(
        duration: number = 120,
        theme?: string,
        userRequest?: string,
        showType?: ShowType
    ): Promise<ShowTimeline> {
        // 1. 选择节目类型和演员阵容
        const selectedShowType = showType || castDirector.randomShowType();
        this.currentCast = castDirector.selectCast(selectedShowType);

        radioMonitor.updateStatus('WRITER', 'BUSY', `Generating ${selectedShowType} script...`);
        radioMonitor.log('WRITER', `Selected Show Type: ${selectedShowType}`);
        const prompt = this.buildPrompt(duration, theme, userRequest);
        radioMonitor.log('WRITER', 'Prompt built, complexity: ' + prompt.length + ' chars');

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < MAX_PARSE_RETRIES; attempt++) {
            try {
                radioMonitor.log('WRITER', `Generation attempt ${attempt + 1}/${MAX_PARSE_RETRIES}...`);
                const response = await this.callAI(prompt + (attempt > 0 ? this.getRetryHint(lastError) : ''));

                radioMonitor.log('WRITER', 'AI responded, starting parser...', 'trace');
                const timeline = this.parseResponse(response);

                radioMonitor.log('WRITER', `Parse successful: ${timeline.blocks.length} blocks generated`, 'info', { id: timeline.id });
                return timeline;
            } catch (error) {
                lastError = error as Error;
                console.warn(`Parse attempt ${attempt + 1} failed:`, error);
            }
        }

        // 所有重试失败，返回默认内容
        radioMonitor.updateStatus('WRITER', 'ERROR', 'AI Generation failed, using fallback');
        return this.getDefaultTimeline();
    }


    /**
     * 获取时段描述
     */
    private getTimeContext(): string {
        const now = new Date();
        const hour = now.getHours();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

        let period = '';
        let mood = '';
        let hosts = '';

        if (hour >= 6 && hour < 9) {
            period = '早间';
            mood = '元气满满，轻快活泼';
            hosts = '早安主播';
        } else if (hour >= 9 && hour < 12) {
            period = '上午';
            mood = '温馨舒适，适合工作';
            hosts = '日间主播';
        } else if (hour >= 12 && hour < 14) {
            period = '午间';
            mood = '轻松惬意，午休时光';
            hosts = '午间主播';
        } else if (hour >= 14 && hour < 18) {
            period = '下午';
            mood = '慵懒舒适，下午茶时光';
            hosts = '午后主播';
        } else if (hour >= 18 && hour < 21) {
            period = '傍晚';
            mood = '温情脉脉，归家时刻';
            hosts = '晚间主播';
        } else if (hour >= 21 && hour < 24) {
            period = '深夜';
            mood = '静谧温柔，夜猫子时光';
            hosts = '深夜主播阿静';
        } else {
            period = '凌晨';
            mood = '梦幻朦胧，失眠者的陪伴';
            hosts = '凌晨主播';
        }

        return `## 当前时间
- 时间: ${dateStr} ${timeStr}
- 时段: ${period}频道
- 氛围: ${mood}
- 主持风格参考: ${hosts}

请根据当前时段生成合适的节目内容和氛围。`;
    }

    /**
     * 构建生成 Prompt
     */
    private buildPrompt(duration: number, theme?: string, userRequest?: string): string {
        const timeContext = this.getTimeContext();
        const castDescription = this.currentCast
            ? castDirector.getCastDescription(this.currentCast)
            : '';

        // 动态生成 speaker 示例
        const speakerExample = this.currentCast?.members[0]?.roleId || 'host1';

        let prompt = `${getRadioSetting()}

${timeContext}

${castDescription}

## 任务
生成一段约 ${duration} 秒的电台节目时间线。

## 输出格式
严格按以下 JSON 格式输出，不要有其他内容：

\`\`\`json
{
  "id": "唯一ID",
  "title": "节目标题",
  "estimatedDuration": ${duration},
  "blocks": [
    {
      "type": "talk",
      "id": "talk-1",
      "scripts": [
        {
          "speaker": "host1",
          "text": "台词内容",
          "mood": "warm",
          "voiceStyle": "温柔地说"
        }
      ],
      "backgroundMusic": {
        "action": "continue",
        "volume": 0.2
      }
    },
    {
      "type": "music",
      "id": "music-1",
      "action": "play",
      "search": "歌名或歌手",
      "duration": 30,
      "intro": {
        "speaker": "host2",
        "text": "接下来这首歌...",
        "mood": "cheerful"
      }
    },
    {
      "type": "music_control",
      "id": "mc-1",
      "action": "fade_out",
      "fadeDuration": 2000
    }
  ]
}
\`\`\`

## 可用类型

### speaker (主持人)
- "host1": 阿静（女）
- "host2": 小北（男）
- "guest": 嘉宾
- "news": 新闻播报

### mood (情绪)
- "cheerful": 开朗
- "calm": 平静
- "excited": 兴奋
- "serious": 严肃
- "warm": 温暖
- "playful": 俏皮
- "melancholy": 忧郁
- "mysterious": 神秘

### backgroundMusic.action
- "continue": 继续播放（调整音量）
- "fade": 淡出
- "pause": 暂停

### music_control.action
- "pause": 暂停
- "resume": 继续
- "fade_out": 淡出
- "fade_in": 淡入

## 内容要求
1. **对话要丰富**：主持人之间的对话要自然、有来有往，每个 talk 块至少 3-5 句台词
2. **音乐时长**：
   - 可以让音乐完整播放（不设 duration，或 duration: 180）
   - 也可以在播放过程中主持人开始说话（通过 backgroundMusic.action: "continue" + volume: 0.15）
3. **过渡自然**：音乐 fade_out 后主持人要有承接的话语
4. **内容深入**：话题展开要详细，不要蜻蜓点水
5. **情感丰富**：台词要有感情起伏，设置合适的 mood 和 voiceStyle
6. **节目节奏**：可以是 [对话] → [音乐完整播放] → [评论] → [背景音乐+聊天]
`;

        if (theme) {
            prompt += `\n## 主题要求\n${theme}\n`;
        }

        if (userRequest) {
            prompt += `\n## 听众来信\n"${userRequest}"\n请在节目中回应这封来信。\n`;
        }

        // 注入上下文记忆（避免重复）
        const context = globalState.getContextForPrompt();
        if (context) {
            prompt += `\n${context}\n`;
        }

        prompt += `\n请直接输出 JSON，不要有任何其他解释文字。`;

        return prompt;
    }

    /**
     * 调用 AI 生成
     */
    private async callAI(prompt: string): Promise<string> {
        const settings = getSettings();
        radioMonitor.updateStatus('WRITER', 'BUSY', 'Calling AI API...');

        let url: string;
        let headers: Record<string, string> = { 'Content-Type': 'application/json' };
        let body: unknown;

        if (settings.apiType === 'vertexai') {
            // Vertex AI 格式
            const isGcpApiKey = settings.apiKey.startsWith('AIza');
            url = `https://${settings.gcpLocation}-aiplatform.googleapis.com/v1/projects/${settings.gcpProject}/locations/${settings.gcpLocation}/publishers/google/models/${settings.modelName}:generateContent`;

            if (isGcpApiKey) {
                url += `?key=${settings.apiKey}`;
            } else {
                headers['Authorization'] = `Bearer ${settings.apiKey}`;
            }

            body = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 8192
                }
            };
        } else if (settings.apiType === 'gemini') {
            // Gemini 格式
            const endpoint = settings.endpoint || 'https://generativelanguage.googleapis.com';
            url = `${this.normalizeEndpoint(endpoint)}/models/${settings.modelName}:generateContent`;
            headers['x-goog-api-key'] = settings.apiKey;
            body = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 8192
                }
            };
        } else {
            // OpenAI 格式
            const endpoint = settings.endpoint || '';
            let baseUrl = endpoint.replace(/\/$/, '');
            if (!baseUrl.endsWith('/v1')) {
                baseUrl = `${baseUrl}/v1`;
            }
            url = `${baseUrl}/chat/completions`;
            headers['Authorization'] = `Bearer ${settings.apiKey}`;
            body = {
                model: settings.modelName,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.8,
                max_tokens: 8192
            };
        }

        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                method: 'POST',
                headers,
                body
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`AI API Error: ${response.status} - ${errorText}`);
            throw new Error(`AI API Error: ${response.status}`);
        }

        const data = await response.json();

        // 根据 API 类型解析响应
        if (settings.apiType === 'openai') {
            return data.choices?.[0]?.message?.content || '';
        } else {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
    }

    /**
     * 解析 AI 响应
     */
    private parseResponse(response: string): ShowTimeline {
        // 提取 JSON 内容
        let jsonStr = response;

        // 策略1: 移除 markdown 代码块（支持完整和截断的情况）
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
        if (jsonMatch && jsonMatch[1].includes('{')) {
            jsonStr = jsonMatch[1];
            console.log('[Writer] Extracted JSON from markdown code block');
        }

        // 策略2: 查找第一个 { 和最后一个 }（通用回退）
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            console.log('[Writer] Extracted JSON by finding braces');
        } else {
            console.error('[Writer] No JSON structure found in response:', response.substring(0, 200));
            throw new Error('No valid JSON structure found in AI response');
        }

        // 尝试解析
        let parsed;
        try {
            parsed = JSON.parse(jsonStr.trim());
        } catch (parseError) {
            console.error('[Writer] JSON parse failed. First 500 chars:', jsonStr.substring(0, 500));
            throw parseError;
        }

        // 验证结构
        if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
            console.error('[Writer] Invalid structure:', Object.keys(parsed));
            throw new Error('Invalid timeline structure: missing blocks array');
        }

        if (parsed.blocks.length === 0) {
            console.error('[Writer] Empty blocks array');
            throw new Error('Invalid timeline: blocks array is empty');
        }

        // 生成缺失的 ID
        parsed.id = parsed.id || `timeline-${Date.now()}`;
        parsed.blocks.forEach((block: TimelineBlock, index: number) => {
            if (!block.id) {
                block.id = `block-${index}`;
            }
        });

        console.log('[Writer] Parse successful:', parsed.blocks.length, 'blocks');
        return parsed as ShowTimeline;
    }

    /**
     * 重试时的提示
     */
    private getRetryHint(error: Error | null): string {
        return `

注意：上次生成的格式有误 (${error?.message})。
请确保：
1. 输出的是有效的 JSON
2. 不要有多余的文字
3. 所有字段名用双引号包裹
`;
    }

    /**
     * 默认时间线（备选） - 根据时段动态生成
     */
    private getDefaultTimeline(): ShowTimeline {
        const hour = new Date().getHours();
        let title = '';
        let greeting = '';
        let speaker = 'host1';

        if (hour >= 6 && hour < 9) {
            title = '晨光电台';
            greeting = '早安！新的一天开始了，让我们用音乐开启美好的早晨。';
        } else if (hour >= 9 && hour < 12) {
            title = '工作伴侣';
            greeting = '工作时间到，让轻松的音乐陪伴你专注工作。';
        } else if (hour >= 12 && hour < 14) {
            title = '午间慢时光';
            greeting = '午休时间，来段轻松的音乐放松一下吧。';
        } else if (hour >= 14 && hour < 18) {
            title = '下午茶电台';
            greeting = '下午好，一杯咖啡，一首歌，享受惬意午后。';
        } else if (hour >= 18 && hour < 21) {
            title = '晚风电台';
            greeting = '傍晚好，结束了一天的忙碌，让音乐温暖归家的路。';
        } else if (hour >= 21 || hour < 2) {
            title = '深夜电波';
            greeting = '夜深了，让我们一起度过这段温暖的时光。';
        } else {
            title = '凌晨守夜人';
            greeting = '夜还很长，让音乐陪伴每一个难眠的夜。';
        }

        return {
            id: `default-${Date.now()}`,
            title,
            estimatedDuration: 90,
            blocks: [
                {
                    type: 'talk',
                    id: 'default-talk-1',
                    scripts: [
                        {
                            speaker: 'host1' as const,
                            text: `欢迎收听${title}。${greeting}`,
                            mood: 'warm'
                        }
                    ]
                },
                {
                    type: 'music',
                    id: 'default-music-1',
                    action: 'play',
                    search: hour >= 21 || hour < 6 ? 'lofi chill sleep' : 'relaxing acoustic guitar',
                    duration: 60,
                    intro: {
                        speaker: 'host1',
                        text: '在开始正式的节目之前，让我们先来听一段轻松的内容。',
                        mood: 'warm'
                    }
                }
            ]
        };
    }

    /**
     * 规范化 endpoint
     */
    private normalizeEndpoint(endpoint: string): string {
        let base = endpoint?.trim() || 'https://generativelanguage.googleapis.com';
        let url = base.replace(/\/$/, '');
        if (!url.endsWith('/v1') && !url.endsWith('/v1beta')) {
            url = `${url}/v1beta`; // 默认使用 v1beta 以支持最新模型
        }
        return url;
    }
}

// 单例导出
export const writerAgent = new WriterAgent();
