/**
 * Director Agent - 导演 Agent
 * 节目调度、音乐控制、时间线执行
 * 支持上下文记忆和双缓冲预加载
 */

import {
    ShowTimeline,
    TimelineBlock,
    TalkBlock,
    MusicBlock,
    MusicControlBlock,
    PlayerState
} from '../types/radio_types';
import { writerAgent } from './writer_agent';
import { ttsAgent } from './tts_agent';
import { audioMixer } from '../audio_mixer';
import { searchMusic, getMusicUrl, getLyrics, IGDMusicTrack } from '../gdmusic_service';
import { globalState } from '../global_state';
import { radioMonitor } from '../radio_monitor';
import { getSettings } from '../settings_store';
import { saveSession } from '../session_store';
import { mailQueue } from '../mail_queue';

// ================== Types ==================

interface ExecutionContext {
    timeline: ShowTimeline;
    currentBlockIndex: number;
    isPaused: boolean;
    onStateChange?: (state: PlayerState) => void;
    onBlockStart?: (block: TimelineBlock, index: number) => void;
    onBlockEnd?: (block: TimelineBlock) => void;
    onError?: (error: Error, block?: TimelineBlock) => void;
    onTimelineReady?: (timeline: ShowTimeline) => void;
}

// ================== Director Agent Class ==================

export class DirectorAgent {
    private context: ExecutionContext | null = null;
    private isRunning = false;
    private preparedAudio: Map<string, ArrayBuffer> = new Map();
    private musicCache: Map<string, IGDMusicTrack> = new Map();
    private musicUrlCache: Map<string, string> = new Map(); // 预加载的音乐 URL

    // 双缓冲：下一段时间线预生成
    private nextTimeline: ShowTimeline | null = null;
    private isPreparingNext = false;

    // 跳转请求标志
    private skipRequested = false;
    private targetBlockIndex = -1;

    /**
     * 启动电台节目
     */
    async startShow(options?: {
        theme?: string;
        userRequest?: string;
        onStateChange?: (state: PlayerState) => void;
        onBlockStart?: (block: TimelineBlock, index: number) => void;
        onBlockEnd?: (block: TimelineBlock) => void;
        onError?: (error: Error, block?: TimelineBlock) => void;
        onTimelineReady?: (timeline: ShowTimeline) => void;
    }): Promise<void> {
        if (this.isRunning) {
            console.warn('Show already running');
            return;
        }

        this.isRunning = true;
        ttsAgent.reset();  // 重置 TTS Agent 中止状态

        // 保存回调
        if (options) {
            this.context = {
                timeline: { id: 'init', title: 'Initializing', blocks: [], estimatedDuration: 0 },
                currentBlockIndex: 0,
                isPaused: false,
                onStateChange: options.onStateChange,
                onBlockStart: options.onBlockStart,
                onBlockEnd: options.onBlockEnd,
                onError: options.onError,
                onTimelineReady: options.onTimelineReady
            };
        }

        // 开始执行循环
        await this.runShowLoop(options?.theme, options?.userRequest);
    }

    /**
     * 内部主运行循环
     */
    private async runShowLoop(theme?: string, userRequest?: string): Promise<void> {
        console.log('[Director] Entering show loop...');
        radioMonitor.updateStatus('DIRECTOR', 'READY', 'Ready to start loop');

        // 下一个时间线的预生成缓冲区
        let nextTimeline: ShowTimeline | null = null;
        let nextTimelineReady = false;
        let isFirstRun = true;

        while (this.isRunning) {
            try {
                let currentTimeline: ShowTimeline;

                if (isFirstRun) {
                    isFirstRun = false;

                    // 首次：同时启动预热播放和主节目生成
                    const warmupPromise = this.playWarmupContent();
                    const timelinePromise = this.generateMainTimeline(theme, userRequest);

                    currentTimeline = await timelinePromise;

                    // 停止预热，切换到主节目
                    audioMixer.stopAll();
                    await this.delay(300);
                } else if (nextTimeline && nextTimelineReady) {
                    // 使用预先生成好的下一期节目
                    radioMonitor.log('DIRECTOR', 'Using pre-generated timeline', 'info');
                    currentTimeline = nextTimeline;
                    nextTimeline = null;
                    nextTimelineReady = false;

                    // 平滑过渡
                    await audioMixer.fadeMusic(0, 1000);
                    audioMixer.stopMusic();
                    await this.delay(300);
                } else {
                    // 备选：如果预生成没准备好，等待生成
                    radioMonitor.log('DIRECTOR', 'Waiting for timeline generation...', 'warn');
                    await audioMixer.fadeMusic(0, 1000);
                    audioMixer.stopMusic();

                    const pendingMail = mailQueue.getNext();
                    currentTimeline = await this.generateMainTimeline(undefined, pendingMail?.content);
                }

                // 设置并预处理当前时间线
                await this.setupTimeline(currentTimeline);
                radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Preparing audio...');
                const preloadCount = getSettings().preloadBlockCount;
                await this.prepareBlocks(0, preloadCount);

                // 🔥 关键：开始播放当前节目的同时，并行生成下一期节目
                const executePromise = this.executeTimeline();

                // 在当前节目播放时，并行生成和准备下一期
                const prepareNextPromise = (async () => {
                    // 等待当前节目播放到一半时开始准备下一期
                    const halfwayDelay = Math.max(5000, (currentTimeline.blocks.length * 3000) / 2);
                    await this.delay(halfwayDelay);

                    if (!this.isRunning) return;

                    radioMonitor.log('DIRECTOR', 'Pre-generating next timeline...', 'info');
                    const pendingMail = mailQueue.getNext();
                    nextTimeline = await this.generateMainTimeline(undefined, pendingMail?.content);

                    if (!this.isRunning || !nextTimeline) return;

                    // 预处理下一期的前半部分音频
                    await this.setupTimeline(nextTimeline, false); // false = 不广播
                    const halfBlocks = Math.ceil(nextTimeline.blocks.length / 2);
                    await this.prepareBlocksForTimeline(nextTimeline, 0, halfBlocks);

                    nextTimelineReady = true;
                    radioMonitor.log('DIRECTOR', 'Next timeline ready', 'info');
                })();

                // 等待当前节目播完
                await executePromise;

            } catch (error) {
                console.error('[Director] Loop error:', error);
                radioMonitor.updateStatus('DIRECTOR', 'ERROR', String(error));
                this.context?.onError?.(error as Error);
                await this.delay(5000);
            }
        }

        radioMonitor.updateStatus('DIRECTOR', 'IDLE', 'Show ended');
        console.log('[Director] Show loop ended.');
    }

    /**
     * 为指定时间线预处理块（不影响当前 context）
     */
    private async prepareBlocksForTimeline(timeline: ShowTimeline, startIndex: number, count: number): Promise<void> {
        const endIndex = Math.min(startIndex + count, timeline.blocks.length);
        const preparePromises: Promise<void>[] = [];

        for (let i = startIndex; i < endIndex; i++) {
            const block = timeline.blocks[i];
            if (block.type === 'talk') {
                preparePromises.push(this.prepareTalkBlock(block));
            } else if (block.type === 'music') {
                preparePromises.push(this.prepareMusicBlock(block));
            }
        }

        await Promise.all(preparePromises);
    }

    /**
     * 播放预热内容（问候语 + 背景音乐循环）
     */
    private async playWarmupContent(): Promise<void> {
        console.log('[Director] Starting warmup content...');
        radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Playing warmup...');

        try {
            // 1. 先开始播放背景音乐
            const musicPromise = this.searchAndPlayIntroMusic();

            // 2. 同时生成简短的开场问候语
            const greeting = this.getQuickGreeting();
            const ttsResult = await ttsAgent.generateSpeech(
                greeting,
                'host1',
                { mood: 'warm', priority: 10 }
            );

            // 3. 播放问候语（叠加在音乐上）
            if (ttsResult.success && ttsResult.audioData) {
                await audioMixer.fadeMusic(0.15, 500);
                await audioMixer.playVoice(ttsResult.audioData);
                await audioMixer.fadeMusic(0.7, 1000);
            }

            radioMonitor.log('DIRECTOR', 'Warmup content playing', 'info');
        } catch (error) {
            console.warn('[Director] Warmup playback error:', error);
        }
    }

    /**
     * 获取快速问候语（不调用 AI，直接生成）
     */
    private getQuickGreeting(): string {
        const hour = new Date().getHours();
        const greetings: Record<string, string> = {
            morning: '早安！欢迎收听电台，新的一天，让我们用音乐和好心情开始。节目正在准备中，先来一首歌吧。',
            noon: '午安！欢迎收听午间电台。工作之余，放松一下。节目马上开始，先听一首轻松的。',
            afternoon: '下午好！欢迎收听下午茶电台。一杯咖啡，一首歌，享受惬意午后。节目正在准备中。',
            evening: '傍晚好！欢迎收听晚间电台。结束了一天的忙碌，让音乐温暖你归家的路。',
            night: '夜深了，欢迎收听深夜电台。让我们一起度过这段温暖的时光。节目马上开始。',
            latenight: '凌晨了还没睡吗？让电台陪伴你。先来一首轻柔的音乐，节目马上开始。'
        };

        if (hour >= 6 && hour < 9) return greetings.morning;
        if (hour >= 9 && hour < 12) return greetings.noon;
        if (hour >= 12 && hour < 18) return greetings.afternoon;
        if (hour >= 18 && hour < 21) return greetings.evening;
        if (hour >= 21 || hour < 2) return greetings.night;
        return greetings.latenight;
    }

    /**
     * 生成主节目时间线
     */
    private async generateMainTimeline(theme?: string, userRequest?: string): Promise<ShowTimeline> {
        const duration = 300; // 5分钟
        console.log(`[Director] Generating new timeline (${duration}s)...`);
        radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Generating timeline...');

        return writerAgent.generateTimeline(duration, theme, userRequest);
    }

    /**
     * 设置时间线到上下文
     * @param broadcast 是否广播时间线更新（预生成时为 false）
     */
    private async setupTimeline(timeline: ShowTimeline, broadcast: boolean = true): Promise<void> {
        console.log('[Director] New timeline generated:', timeline.id, 'with', timeline.blocks.length, 'blocks');

        if (broadcast) {
            radioMonitor.emitTimeline(timeline);
        }

        // 同步演员阵容到 TTS Agent
        const cast = writerAgent.getCurrentCast();
        if (cast) {
            ttsAgent.setActiveCast(cast);
        }

        // 更新上下文（仅在广播模式，即当前播放时）
        if (broadcast) {
            if (this.context) {
                this.context.timeline = timeline;
                this.context.currentBlockIndex = 0;
                this.context.onTimelineReady?.(timeline);
            } else {
                this.context = {
                    timeline,
                    currentBlockIndex: 0,
                    isPaused: false,
                };
            }
        }
    }

    /**
     * 搜索并播放开场音乐
     */
    private async searchAndPlayIntroMusic(): Promise<string | null> {
        // 根据时段选择不同风格的开场音乐
        const hour = new Date().getHours();
        let keyword = 'lofi chill';

        if (hour >= 6 && hour < 9) {
            keyword = 'morning upbeat positive';
        } else if (hour >= 9 && hour < 18) {
            keyword = 'work focus ambient';
        } else if (hour >= 18 && hour < 21) {
            keyword = 'evening jazz relaxing';
        } else {
            keyword = 'night lofi sleep';
        }

        try {
            const result = await audioMixer.playMusicFromSearch(keyword);
            return result ? keyword : null;
        } catch {
            return null;
        }
    }

    /**
     * 停止节目
     */
    stopShow(): void {
        this.isRunning = false;
        audioMixer.stopAll();
        ttsAgent.abort();  // 中止所有 TTS 请求
        this.context = null;
        this.preparedAudio.clear();
        this.nextTimeline = null;
        this.isPreparingNext = false;
        globalState.reset();
        // 重置所有 Agent 状态
        radioMonitor.updateStatus('DIRECTOR', 'IDLE', 'Disconnected');
        radioMonitor.updateStatus('WRITER', 'IDLE', 'Disconnected');
        radioMonitor.updateStatus('TTS', 'IDLE', 'Disconnected');
        radioMonitor.updateStatus('MIXER', 'IDLE', 'Disconnected');
    }

    /**
     * 暂停节目
     */
    pauseShow(): void {
        if (this.context) {
            this.context.isPaused = true;
            audioMixer.pauseAll();
        }
    }

    /**
     * 继续节目
     */
    resumeShow(): void {
        if (this.context) {
            this.context.isPaused = false;
            audioMixer.resumeAll();
        }
    }

    /**
     * 跳到下一段
     */
    skipToNext(): void {
        if (!this.context) return;

        const { timeline } = this.context;
        const nextIndex = this.context.currentBlockIndex + 1;

        if (nextIndex < timeline.blocks.length) {
            // 设置跳转请求标志
            this.skipRequested = true;
            this.targetBlockIndex = nextIndex;
            // 立即停止当前音频
            audioMixer.stopAll();
            console.log('[Director] Skip to next:', nextIndex);
        }
    }

    /**
     * 跳到上一段
     */
    skipToPrevious(): void {
        if (!this.context) return;

        const prevIndex = this.context.currentBlockIndex - 1;

        if (prevIndex >= 0) {
            // 设置跳转请求标志
            this.skipRequested = true;
            this.targetBlockIndex = prevIndex;
            // 立即停止当前音频
            audioMixer.stopAll();
            console.log('[Director] Skip to previous:', prevIndex);
        }
    }

    /**
     * 跳到指定段落
     */
    skipToBlock(index: number): void {
        if (!this.context) return;

        const { timeline } = this.context;

        if (index >= 0 && index < timeline.blocks.length) {
            // 设置跳转请求标志
            this.skipRequested = true;
            this.targetBlockIndex = index;
            // 立即停止当前音频
            audioMixer.stopAll();
            console.log('[Director] Skip requested to block:', index);
        }
    }

    /**
     * 获取当前播放信息
     */
    getPlaybackInfo(): { current: number; total: number } | null {
        if (!this.context) return null;
        return {
            current: this.context.currentBlockIndex,
            total: this.context.timeline.blocks.length
        };
    }

    /**
     * 预处理块（生成 TTS 和获取音乐）
     */
    private async prepareBlocks(startIndex: number, count: number): Promise<void> {
        if (!this.context) return;

        const { timeline } = this.context;
        const endIndex = Math.min(startIndex + count, timeline.blocks.length);

        const preparePromises: Promise<void>[] = [];

        for (let i = startIndex; i < endIndex; i++) {
            const block = timeline.blocks[i];

            if (block.type === 'talk') {
                // 预生成所有台词的 TTS
                preparePromises.push(this.prepareTalkBlock(block));
            } else if (block.type === 'music') {
                // 预搜索音乐
                preparePromises.push(this.prepareMusicBlock(block));
            }
        }

        await Promise.all(preparePromises);
    }

    /**
     * 预处理说话块（智能选择单人/多人 TTS）
     */
    private async prepareTalkBlock(block: TalkBlock): Promise<void> {
        const settings = getSettings();

        // 收集唯一说话人数量
        const uniqueSpeakers = new Set(block.scripts.map(s => s.speaker));

        // Gemini TTS 且说话人数 ≤ 2 时，使用多说话人模式
        if (settings.ttsProvider === 'gemini' && uniqueSpeakers.size <= 2 && block.scripts.length >= 2) {
            await this.prepareTalkBlockMultiSpeaker(block);
        } else {
            await this.prepareTalkBlockSingle(block);
        }
    }

    /**
     * 多说话人模式预处理（Gemini 专用）
     */
    private async prepareTalkBlockMultiSpeaker(block: TalkBlock): Promise<void> {
        const multiAudioId = `${block.id}-multi`;

        if (this.preparedAudio.has(multiAudioId)) return;

        try {
            const result = await ttsAgent.generateMultiSpeakerSpeech(
                block.scripts.map(s => ({
                    speaker: s.speaker,
                    text: s.text,
                    voiceName: s.voiceName,
                    mood: s.mood
                }))
            );

            if (result.success && result.audioData) {
                // 存储为整个块的音频
                this.preparedAudio.set(multiAudioId, result.audioData);
            }
        } catch (error) {
            console.error('Multi-speaker TTS preparation failed:', error);
            // 降级为单独处理
            await this.prepareTalkBlockSingle(block);
        }
    }

    /**
     * 单说话人模式预处理（原方法）
     */
    private async prepareTalkBlockSingle(block: TalkBlock): Promise<void> {
        const ttsPromises = block.scripts.map(async (script) => {
            const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;

            if (this.preparedAudio.has(audioId)) return;

            try {
                const result = await ttsAgent.generateSpeech(
                    script.text,
                    script.speaker,
                    {
                        mood: script.mood,
                        customStyle: script.voiceStyle,
                        priority: 8,
                        voiceName: script.voiceName
                    }
                );

                if (result.success && result.audioData) {
                    this.preparedAudio.set(audioId, result.audioData);
                }
            } catch (error) {
                console.error('TTS preparation failed:', error);
            }
        });

        await Promise.all(ttsPromises);
    }

    /**
     * 预处理音乐块 (获取音乐URL和歌词)
     */
    private async prepareMusicBlock(block: MusicBlock): Promise<void> {
        if (this.musicCache.has(block.search) && this.musicUrlCache.has(block.search)) {
            return; // 已经完全缓存
        }

        try {
            const tracks = await searchMusic(block.search);
            if (tracks.length > 0) {
                const track = tracks[0];
                this.musicCache.set(block.search, track);

                // 并行获取 URL 和歌词
                const [url, lyrics] = await Promise.all([
                    getMusicUrl(track.id, 320, track.source),
                    getLyrics(track.lyricId, track.source)
                ]);

                // 缓存 URL
                if (url) {
                    this.musicUrlCache.set(block.search, url);
                    console.log('[Director] Preloaded music URL for:', track.name);
                }

                // 存储歌词到全局上下文
                if (lyrics?.lyric) {
                    const cleanLyrics = this.parseLrcToText(lyrics.lyric);
                    globalState.addRecentlyPlayedSong({
                        name: track.name,
                        artist: track.artist.join(', '),
                        lyrics: cleanLyrics.slice(0, 500)
                    });
                    console.log('[Director] Fetched lyrics for:', track.name);
                }
            }
        } catch (error) {
            console.error('Music preload failed:', error);
        }
    }

    /**
     * 解析 LRC 格式歌词为纯文本
     */
    private parseLrcToText(lrc: string): string {
        return lrc
            .split('\n')
            .map(line => line.replace(/\[\d{2}:\d{2}(\.\d+)?\]/g, '').trim())
            .filter(line => line.length > 0)
            .join('\n');
    }

    /**
     * 执行时间线
     */
    private async executeTimeline(): Promise<void> {
        if (!this.context) return;

        const { timeline } = this.context;

        while (this.isRunning && this.context.currentBlockIndex < timeline.blocks.length) {
            // 检查跳转请求
            if (this.skipRequested) {
                this.skipRequested = false;
                if (this.targetBlockIndex >= 0 && this.targetBlockIndex < timeline.blocks.length) {
                    this.context.currentBlockIndex = this.targetBlockIndex;
                    this.targetBlockIndex = -1;
                    console.log('[Director] Jumped to block:', this.context.currentBlockIndex);
                    // 预处理新位置的块
                    const preloadCount = getSettings().preloadBlockCount;
                    await this.prepareBlocks(this.context.currentBlockIndex, preloadCount);
                }
            }

            // 检查暂停状态
            while (this.context.isPaused && this.isRunning && !this.skipRequested) {
                await this.delay(100);
            }

            if (!this.isRunning) break;
            if (this.skipRequested) continue; // 有新的跳转请求，立即处理

            // 防止 disconnect 后 context 被清空
            if (!this.context) break;

            const block = timeline.blocks[this.context.currentBlockIndex];

            // 通知块开始
            this.context.onBlockStart?.(block, this.context.currentBlockIndex);
            radioMonitor.emitScript(block.type === 'talk' ? 'host1' : 'system', `Playing: ${block.type}`, block.id);

            try {
                // 执行块（会在跳转时被中断）
                await this.executeBlock(block);

                // 如果有跳转请求，不触发 onBlockEnd
                if (!this.skipRequested && this.context) {
                    this.context.onBlockEnd?.(block);
                }
            } catch (error) {
                // 忽略 abort 错误
                if ((error as Error).name === 'AbortError') {
                    console.log('[Director] Request aborted');
                    break;
                }
                console.error('Block execution error:', error);
                if (this.context) {
                    this.context.onError?.(error as Error, block);
                }
            }

            // 防止 disconnect 后 context 被清空
            if (!this.context) break;

            // 如果有跳转请求，不自动递增
            if (!this.skipRequested) {
                this.context.currentBlockIndex++;

                // 自动保存会话进度
                saveSession({
                    id: timeline.id,
                    timeline: timeline,
                    currentBlockIndex: this.context.currentBlockIndex,
                    playbackPosition: 0
                });

                // 预处理后续块
                const remainingBlocks = timeline.blocks.length - this.context.currentBlockIndex;
                if (remainingBlocks > 0) {
                    const preloadCount = getSettings().preloadBlockCount;
                    this.prepareBlocks(this.context.currentBlockIndex, preloadCount);
                }
            }
        }
    }

    /**
     * 预生成下一段时间线（双缓冲）
     */
    private async prepareNextTimeline(): Promise<void> {
        if (this.isPreparingNext || this.nextTimeline) return;

        this.isPreparingNext = true;
        console.log('[Director] Pre-generating next timeline...');

        try {
            // 使用 globalState 的上下文
            const timeline = await writerAgent.generateTimeline(120);
            this.nextTimeline = timeline;

            // 预处理前几块
            await this.prepareBlocksForTimeline(timeline, 0, 2);

            console.log('[Director] Next timeline ready');
        } catch (error) {
            console.error('[Director] Failed to pre-generate:', error);
        } finally {
            this.isPreparingNext = false;
        }
    }

    /**
     * 执行单个块
     */
    private async executeBlock(block: TimelineBlock): Promise<void> {
        switch (block.type) {
            case 'talk':
                await this.executeTalkBlock(block);
                break;
            case 'music':
                await this.executeMusicBlock(block);
                break;
            case 'music_control':
                await this.executeMusicControlBlock(block);
                break;
            case 'silence':
                await this.delay(block.duration);
                break;
        }
    }

    /**
     * 执行说话块
     */
    private async executeTalkBlock(block: TalkBlock): Promise<void> {
        // 处理背景音乐
        if (block.backgroundMusic) {
            const { action, volume } = block.backgroundMusic;
            switch (action) {
                case 'fade':
                    await audioMixer.fadeMusic(volume || 0.1, 1000);
                    break;
                case 'pause':
                    audioMixer.pauseMusic();
                    break;
                case 'continue':
                    if (volume !== undefined) {
                        audioMixer.setMusicVolume(volume);
                    }
                    break;
            }
        }

        // 检查是否有多说话人合并音频
        const multiAudioId = `${block.id}-multi`;
        const multiAudioData = this.preparedAudio.get(multiAudioId);

        if (multiAudioData) {
            // 多说话人模式：播放整个块的合并音频
            radioMonitor.log('DIRECTOR', `Playing multi-speaker audio for ${block.scripts.length} lines`, 'info');

            // 发出所有脚本事件（用于字幕显示）
            for (const script of block.scripts) {
                radioMonitor.emitScript(script.speaker, script.text, block.id);
            }

            try {
                await audioMixer.playVoice(multiAudioData);
            } catch (e) {
                console.warn('[Director] Multi-speaker voice playback failed:', e);
            }

            // 记录话题
            for (const script of block.scripts) {
                globalState.addTopic(script.text.slice(0, 50), script.speaker);
            }
        } else {
            // 单说话人模式：逐句播放
            await this.executeTalkBlockSingle(block);
        }
    }

    /**
     * 单说话人模式播放（逐句）
     */
    private async executeTalkBlockSingle(block: TalkBlock): Promise<void> {
        for (const script of block.scripts) {
            // 检测跳转请求，立即中断
            if (!this.isRunning || this.skipRequested) break;

            // 发出脚本开始事件
            radioMonitor.emitScript(script.speaker, script.text, block.id);

            const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;
            const audioData = this.preparedAudio.get(audioId);

            if (audioData) {
                try {
                    await audioMixer.playVoice(audioData);
                } catch (e) {
                    console.warn('[Director] Voice playback failed, skipping:', e);
                }
            } else {
                // 实时生成（备选）
                try {
                    const result = await ttsAgent.generateSpeech(
                        script.text,
                        script.speaker,
                        { mood: script.mood, customStyle: script.voiceStyle, voiceName: script.voiceName }
                    );
                    if (result.success && result.audioData) {
                        await audioMixer.playVoice(result.audioData);
                    } else {
                        console.warn('[Director] TTS generation failed:', result.error);
                    }
                } catch (e) {
                    console.warn('[Director] TTS error, continuing:', e);
                }
            }

            // 台词间暂停
            if (script.pause) {
                await this.delay(script.pause);
            }

            // 记录话题到 globalState
            globalState.addTopic(script.text.slice(0, 50), script.speaker);
        }
    }

    /**
     * 执行音乐块
     */
    private async executeMusicBlock(block: MusicBlock): Promise<void> {
        // 播放介绍词
        if (block.intro) {
            const result = await ttsAgent.generateSpeech(
                block.intro.text,
                block.intro.speaker,
                { mood: block.intro.mood }
            );
            if (result.success && result.audioData) {
                await audioMixer.playVoice(result.audioData);
            }
        }

        // 优先使用预加载的 URL
        let url = this.musicUrlCache.get(block.search);
        let track = this.musicCache.get(block.search);

        // 如果没有缓存，实时获取
        if (!track || !url) {
            const tracks = await searchMusic(block.search);
            if (tracks.length > 0) {
                track = tracks[0];
                url = await getMusicUrl(track.id) || undefined;
            }
        }
        if (url && track) {
            await audioMixer.playMusic(url, {
                fadeIn: block.fadeIn
            });

            // 记录到 globalState
            globalState.addTrack(block.search);

            // 如果指定了时长，等待后淡出
            if (block.duration) {
                await this.delay(block.duration * 1000);
                await audioMixer.fadeMusic(0, 2000);
                audioMixer.stopMusic();
            }
        }
    }

    /**
     * 执行音乐控制块
     * fade_out 改为非阻塞式，让语音可以立即开始
     */
    private async executeMusicControlBlock(block: MusicControlBlock): Promise<void> {
        switch (block.action) {
            case 'pause':
                audioMixer.pauseMusic();
                break;
            case 'resume':
                audioMixer.resumeMusic();
                break;
            case 'fade_out':
                // 非阻塞式 fade out - 让语音可以立即开始
                // 音乐会在后台渐渐降低音量
                audioMixer.fadeMusic(0, block.fadeDuration || 2000);
                // 给一个短暂的过渡时间
                await this.delay(300);
                break;
            case 'fade_in':
                await audioMixer.fadeMusic(block.targetVolume || 0.7, block.fadeDuration || 2000);
                break;
            case 'stop':
                audioMixer.stopMusic();
                break;
        }
    }

    /**
     * 获取当前状态
     */
    getState(): PlayerState {
        const audioState = audioMixer.getState();

        return {
            isPlaying: this.isRunning && !this.context?.isPaused,
            currentBlockId: this.context?.timeline.blocks[this.context.currentBlockIndex]?.id || null,
            musicState: {
                isPlaying: audioState.music.isPlaying,
                currentTrack: null,
                volume: audioState.music.volume
            },
            voiceState: {
                isPlaying: audioState.voice.isPlaying,
                currentScriptId: null
            },
            queue: {
                pending: this.context?.timeline.blocks.length || 0,
                ready: this.preparedAudio.size,
                generating: 0
            }
        };
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 单例导出
export const directorAgent = new DirectorAgent();
