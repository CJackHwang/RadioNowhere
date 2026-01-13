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
import { AUDIO, SHOW, TRANSITION, AGENT } from '../constants';
import { timeAnnouncementService } from '../time_announcement';
import { recordShow, recordSong } from '../show_history';
import { addProhibitedArtist } from '../music_diversity';

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
    private musicUrlCache: Map<string, { url: string; cachedAt: number }> = new Map(); // 预加载的音乐 URL + 缓存时间
    private musicDataCache: Map<string, Blob> = new Map(); // 下载的音乐文件缓存
    private readonly MUSIC_URL_TTL_MS = 20 * 60 * 1000; // URL 有效期：20 分钟

    // 双缓冲：下一段时间线预生成
    private nextTimeline: ShowTimeline | null = null;
    private isPreparingNext = false;

    // 跳转请求标志
    private skipRequested = false;

    // Session ID 防止并行播放
    private currentSessionId = 0;
    private targetBlockIndex = -1;

    // 后台预加载 worker
    private preloadWorkerInterval: ReturnType<typeof setInterval> | null = null;
    private isPreparing: Set<string> = new Set(); // 正在准备中的块 ID

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
        this.currentSessionId++;  // 新 session，旧循环会检测到并退出
        const sessionId = this.currentSessionId;
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

        // 启动报时服务
        timeAnnouncementService.start();

        // 开始执行循环，传入 sessionId
        await this.runShowLoop(options?.theme, options?.userRequest, sessionId);
    }

    /**
     * 内部主运行循环
     */
    private async runShowLoop(theme?: string, userRequest?: string, sessionId?: number): Promise<void> {
        console.log('[Director] Entering show loop... (session:', sessionId, ')');
        radioMonitor.updateStatus('DIRECTOR', 'READY', 'Ready to start loop');

        // 下一个时间线的预生成缓冲区
        let nextTimeline: ShowTimeline | null = null;
        let nextTimelineReady = false;
        let isFirstRun = true;

        // 检查 session 是否仍然有效（防止并行播放）
        const isValidSession = () => sessionId === undefined || sessionId === this.currentSessionId;

        while (this.isRunning && isValidSession()) {
            try {
                let currentTimeline: ShowTimeline;

                if (isFirstRun) {
                    isFirstRun = false;

                    // 首次：同时启动预热播放和主节目生成
                    this.playWarmupContent();
                    const timelinePromise = this.generateMainTimeline(theme, userRequest);

                    currentTimeline = await timelinePromise;

                    // 设置并预处理当前时间线
                    await this.setupTimeline(currentTimeline);
                    radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Preparing audio...');

                    const preloadCount = getSettings().preloadBlockCount;

                    // 异步启动准备（不阻塞）
                    const preparePromise = this.prepareBlocks(0, preloadCount);

                    // 等待第一个块准备好（最多15秒）
                    await this.waitForFirstBlockReady(currentTimeline, 15000);

                    // 现在才停止 warmup，淡出过渡（1.5秒）
                    await audioMixer.fadeMusic(0, 1500);
                    audioMixer.stopAll();
                    audioMixer.setMusicVolume(AUDIO.MUSIC_DEFAULT_VOLUME);  // 重置音量到默认值
                    await this.delay(300);

                    // 后台继续准备其他块（不阻塞播放开始）
                    preparePromise.catch(err => {
                        radioMonitor.log('DIRECTOR', `Background prepare warning: ${err}`, 'warn');
                    });
                } else if (nextTimeline && nextTimelineReady) {
                    // 使用预先生成好的下一期节目
                    radioMonitor.log('DIRECTOR', 'Using pre-generated timeline', 'info');
                    currentTimeline = nextTimeline;
                    nextTimeline = null;
                    nextTimelineReady = false;

                    // 节目间过渡音乐（30秒-60秒轻音乐过渡）
                    radioMonitor.log('DIRECTOR', 'Playing transition music...', 'info');
                    await this.playTransitionMusic();
                    await this.delay(500);

                    // 设置并预处理当前时间线
                    await this.setupTimeline(currentTimeline);
                    radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Preparing audio...');
                    const preloadCount = getSettings().preloadBlockCount;
                    await this.prepareBlocks(0, preloadCount);
                } else {
                    // 备选：如果预生成没准备好，等待生成
                    radioMonitor.log('DIRECTOR', 'Waiting for timeline generation...', 'warn');
                    await audioMixer.fadeMusic(0, 1000);
                    audioMixer.stopMusic();
                    audioMixer.setMusicVolume(AUDIO.MUSIC_DEFAULT_VOLUME);  // 重置音量到默认值

                    const pendingMail = mailQueue.getNext();
                    currentTimeline = await this.generateMainTimeline(undefined, pendingMail?.content);

                    // 设置并预处理当前时间线
                    await this.setupTimeline(currentTimeline);
                    radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Preparing audio...');
                    const preloadCount = getSettings().preloadBlockCount;
                    await this.prepareBlocks(0, preloadCount);
                }

                // 启动后台预加载 worker（持续保持缓冲区满）
                this.startPreloadWorker();

                // 🔥 关键：开始播放当前节目的同时，并行生成下一期节目
                const executePromise = this.executeTimeline(sessionId);

                // 在当前节目播放时，并行生成和准备下一期
                (async () => {
                    // 等待当前节目播放到一半时开始准备下一期
                    const halfwayDelay = Math.max(AGENT.HALFWAY_DELAY_MIN_MS, (currentTimeline.blocks.length * 3000) / 2);
                    await this.delay(halfwayDelay);

                    if (!this.isRunning || !isValidSession()) return;

                    radioMonitor.log('DIRECTOR', 'Pre-generating next timeline...', 'info');
                    const pendingMail = mailQueue.getNext();
                    nextTimeline = await this.generateMainTimeline(undefined, pendingMail?.content);

                    if (!this.isRunning || !isValidSession() || !nextTimeline) return;

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
                const musicBlock = block as MusicBlock;
                preparePromises.push((async () => {
                    await this.renewMusicUrlIfNeeded(musicBlock);
                    await this.prepareMusicBlock(musicBlock);
                })());
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
            this.searchAndPlayIntroMusic();

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
     * 播放节目间过渡音乐（30-60秒轻音乐）
     */
    private async playTransitionMusic(): Promise<void> {
        console.log('[Director] Playing transition music...');
        radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Playing transition...');

        try {
            const queries = TRANSITION.SEARCH_QUERIES;
            const query = queries[Math.floor(Math.random() * queries.length)];

            const tracks = await searchMusic(query, 5);
            if (tracks.length === 0) {
                // 如果搜索失败，简单延迟
                await this.delay(5000);
                return;
            }

            // 随机选择一首
            const track = tracks[Math.floor(Math.random() * tracks.length)];
            const sourceType = track.source === 'tencent' ? 'tencent' : 'netease';
            const url = await getMusicUrl(String(track.id), 320, sourceType);

            if (url) {
                // 设置较低的音量用于过渡
                audioMixer.setMusicVolume(TRANSITION.MUSIC_VOLUME);

                // 播放 30-45 秒过渡音乐
                const transitionDuration = TRANSITION.MIN_DURATION_MS + Math.random() * (TRANSITION.MAX_DURATION_MS - TRANSITION.MIN_DURATION_MS);
                const playResult = await audioMixer.playMusic(url, { fadeIn: TRANSITION.FADE_IN_MS });
                if (!playResult.success) {
                    radioMonitor.log('DIRECTOR', `Transition music playback failed: ${playResult.error}`, 'warn');
                    await this.delay(3000);
                    return;
                }

                // 等待过渡时长
                await this.delay(transitionDuration);

                // 淡出
                await audioMixer.fadeMusic(0, TRANSITION.FADE_OUT_MS);
                audioMixer.stopMusic();

                // 恢复音量
                audioMixer.setMusicVolume(AUDIO.MUSIC_AFTER_TRANSITION);
            }
        } catch (error) {
            console.warn('[Director] Transition music error:', error);
            await this.delay(3000);
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
        const duration = SHOW.MAIN_DURATION;
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
        this.stopPreloadWorker(); // 停止后台预加载
        audioMixer.stopAll();
        ttsAgent.abort();  // 中止所有 TTS 请求
        timeAnnouncementService.stop(); // 停止报时服务
        this.context = null;
        this.preparedAudio.clear();
        this.musicDataCache.clear(); // 清理下载的音乐
        this.isPreparing.clear();
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
     * 启动后台预加载 worker
     * 持续监控缓冲区，始终保持指定数量的音频块准备就绪
     */
    private startPreloadWorker(): void {
        if (this.preloadWorkerInterval) return; // 已经在运行

        const WORKER_INTERVAL_MS = 2000; // 每 2 秒检查一次

        this.preloadWorkerInterval = setInterval(async () => {
            if (!this.isRunning || !this.context) return;

            const { timeline, currentBlockIndex } = this.context;
            const preloadCount = getSettings().preloadBlockCount;
            const endIndex = Math.min(currentBlockIndex + preloadCount, timeline.blocks.length);

            // 检查从当前块到 preloadCount 范围内的所有块
            for (let i = currentBlockIndex; i < endIndex; i++) {
                const block = timeline.blocks[i];
                if (!block) continue;

                // 检查是否已准备好或正在准备
                if (this.isBlockPrepared(block) || this.isPreparing.has(block.id)) {
                    continue;
                }

                // 标记为正在准备
                this.isPreparing.add(block.id);
                radioMonitor.log('DIRECTOR', `Preloader: preparing block ${i} (${block.type})`, 'trace');

                // 异步准备，不阻塞 worker
                this.prepareBlockAsync(block).finally(() => {
                    this.isPreparing.delete(block.id);
                });
            }

            // 日志：缓冲区状态
            const preparedCount = this.countPreparedBlocks(currentBlockIndex, endIndex);
            radioMonitor.updateStatus('TTS', 'READY', `Buffer: ${preparedCount}/${preloadCount}`);
        }, WORKER_INTERVAL_MS);

        radioMonitor.log('DIRECTOR', 'Preload worker started', 'info');
    }

    /**
     * 停止后台预加载 worker
     */
    private stopPreloadWorker(): void {
        if (this.preloadWorkerInterval) {
            clearInterval(this.preloadWorkerInterval);
            this.preloadWorkerInterval = null;
            radioMonitor.log('DIRECTOR', 'Preload worker stopped', 'info');
        }
    }

    /**
     * 检查块是否已准备好
     */
    private isBlockPrepared(block: TimelineBlock): boolean {
        if (block.type === 'talk') {
            const talkBlock = block as TalkBlock;
            // 检查多说话人模式
            const multiAudioId = `${block.id}-multi`;
            if (this.preparedAudio.has(multiAudioId)) return true;
            // 检查单说话人模式（所有脚本都已准备）
            return talkBlock.scripts.every(script => {
                const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;
                return this.preparedAudio.has(audioId);
            });
        } else if (block.type === 'music') {
            const musicBlock = block as MusicBlock;
            // 检查是否已下载到本地缓存
            return this.musicDataCache.has(musicBlock.search);
        }
        return true; // music_control 等不需要准备
    }

    /**
     * 等待第一个块准备好（带超时保护）
     */
    private async waitForFirstBlockReady(timeline: ShowTimeline, timeoutMs: number): Promise<void> {
        if (!timeline.blocks.length) return;

        const startTime = Date.now();
        const firstBlock = timeline.blocks[0];

        while (Date.now() - startTime < timeoutMs) {
            if (this.isBlockPrepared(firstBlock)) {
                radioMonitor.log('DIRECTOR', 'First block ready, starting playback', 'info');
                return;
            }

            await this.delay(200);
        }

        // 超时也继续，降级播放
        radioMonitor.log('DIRECTOR', 'First block not ready after timeout, starting anyway', 'warn');
    }

    /**
     * 计算已准备好的块数量
     */
    private countPreparedBlocks(startIndex: number, endIndex: number): number {
        if (!this.context) return 0;
        let count = 0;
        for (let i = startIndex; i < endIndex; i++) {
            const block = this.context.timeline.blocks[i];
            if (block && this.isBlockPrepared(block)) count++;
        }
        return count;
    }

    /**
     * 异步准备单个块
     */
    private async prepareBlockAsync(block: TimelineBlock): Promise<void> {
        try {
            if (block.type === 'talk') {
                await this.prepareTalkBlock(block as TalkBlock);
            } else if (block.type === 'music') {
                await this.prepareMusicBlock(block as MusicBlock);
            }
        } catch (error) {
            console.error(`[Preloader] Failed to prepare block ${block.id}:`, error);
        }
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
        if (!this.context) {
            console.log('[Director] skipToBlock: no context');
            return;
        }

        const { timeline } = this.context;

        if (index >= 0 && index < timeline.blocks.length) {
            console.log('[Director] Skip requested to block:', index, 'current:', this.context.currentBlockIndex);

            // 设置跳转请求标志
            this.skipRequested = true;
            this.targetBlockIndex = index;

            // 如果暂停中，自动恢复播放
            if (this.context.isPaused) {
                this.context.isPaused = false;
                radioMonitor.log('DIRECTOR', 'Resuming from pause for skip', 'info');
            }

            // 立即停止当前音频
            audioMixer.stopAll();
            radioMonitor.log('DIRECTOR', `Jumping to block ${index}`, 'info');
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
     * 流式准备：第一个块优先等待，其他块异步准备
     */
    private async prepareBlocks(startIndex: number, count: number): Promise<void> {
        if (!this.context) return;

        const { timeline } = this.context;
        const endIndex = Math.min(startIndex + count, timeline.blocks.length);

        // 启动所有准备任务（异步，不阻塞）
        const preparePromises: Promise<void>[] = [];

        for (let i = startIndex; i < endIndex; i++) {
            const block = timeline.blocks[i];

            if (block.type === 'talk') {
                // 异步准备，错误不阻塞
                preparePromises.push(
                    this.prepareTalkBlock(block).catch(err => {
                        radioMonitor.log('DIRECTOR', `Talk block ${i} prepare failed: ${err}`, 'warn');
                    })
                );
            } else if (block.type === 'music') {
                preparePromises.push(
                    this.prepareMusicBlock(block).catch(err => {
                        radioMonitor.log('DIRECTOR', `Music block ${i} prepare failed: ${err}`, 'warn');
                    })
                );
            }
        }

        // 只等待第一个块
        const firstBlock = timeline.blocks[startIndex];
        if (firstBlock && !this.isBlockPrepared(firstBlock)) {
            if (firstBlock.type === 'talk') {
                await this.prepareTalkBlock(firstBlock);
            } else if (firstBlock.type === 'music') {
                await this.prepareMusicBlock(firstBlock);
            }
        }

        // 其他块在后台继续准备（由 preloadWorker 持续接管）
        // 不阻塞播放开始
    }

    /**
     * 预处理说话块（智能选择单人/多人 TTS）
     */
    private async prepareTalkBlock(block: TalkBlock): Promise<void> {
        const settings = getSettings();

        // 收集唯一说话人数量
        const uniqueSpeakers = new Set(block.scripts.map(s => s.speaker));

        // Gemini TTS 且正好 2 个说话人时，使用多说话人模式
        // 注意：multi-speaker API 需要至少 2 个不同的说话人
        if (settings.ttsProvider === 'gemini' && uniqueSpeakers.size === 2 && block.scripts.length >= 2) {
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

    private async renewMusicUrlIfNeeded(block: MusicBlock): Promise<void> {
        const cached = this.musicUrlCache.get(block.search);
        if (!cached) return;

        const age = Date.now() - cached.cachedAt;
        const remainingMs = this.MUSIC_URL_TTL_MS - age;
        if (remainingMs >= 5 * 60 * 1000) return;

        const track = this.musicCache.get(block.search);
        if (!track) return;

        try {
            const newUrl = await getMusicUrl(track.id, 320, track.source);
            if (newUrl) {
                this.musicUrlCache.set(block.search, { url: newUrl, cachedAt: Date.now() });
                radioMonitor.log('DIRECTOR', `Music URL renewed: ${block.search}`, 'info');
            }
        } catch (err) {
            radioMonitor.log('DIRECTOR', `Failed to renew URL: ${err}`, 'warn');
        }
    }

    /**
     * 预处理音乐块 (获取音乐URL、下载并获取歌词)
     */
    private async prepareMusicBlock(block: MusicBlock): Promise<void> {
        // 1. 检查是否已完全下载
        if (this.musicDataCache.has(block.search)) {
            // 检查缓存是否有效（这里假设 Blob 只要在内存中就有效，虽然 URL 可能过期但 Blob 用于本地播放）
            radioMonitor.log('DIRECTOR', `Music cache hit (RAM): ${block.search}`, 'trace');
            return;
        }

        // 2. 检查是否有 URL 缓存但未下载（例如下载失败的情况）
        let cachedUrl = this.musicUrlCache.get(block.search);
        let urlToDownload = cachedUrl?.url;

        try {
            if (!this.musicCache.has(block.search)) {
                radioMonitor.log('DIRECTOR', `Searching music: ${block.search}`, 'info');
                const tracks = await searchMusic(block.search);
                if (tracks.length > 0) {
                    this.musicCache.set(block.search, tracks[0]);
                } else {
                    radioMonitor.log('DIRECTOR', `Music not found: ${block.search}`, 'warn');
                    return;
                }
            }

            const track = this.musicCache.get(block.search)!;

            // 预加载/预生成时：如果 URL 即将过期，提前续期，避免播放/下载过程中失效
            await this.renewMusicUrlIfNeeded(block);
            cachedUrl = this.musicUrlCache.get(block.search);
            urlToDownload = cachedUrl?.url;

            // 如果 URL 已过期，清除
            if (cachedUrl) {
                const age = Date.now() - cachedUrl.cachedAt;
                if (age >= this.MUSIC_URL_TTL_MS) {
                    this.musicUrlCache.delete(block.search);
                    urlToDownload = undefined;
                    radioMonitor.log('DIRECTOR', `Music URL expired, re-fetching...`, 'info');
                }
            }

            // 获取 URL (如果没有有效缓存)
            if (!urlToDownload) {
                const [newUrl, lyrics] = await Promise.all([
                    getMusicUrl(track.id, 320, track.source),
                    getLyrics(track.lyricId, track.source)
                ]);

                if (newUrl) {
                    urlToDownload = newUrl;
                    this.musicUrlCache.set(block.search, { url: newUrl, cachedAt: Date.now() });
                }

                if (lyrics?.lyric) {
                    const cleanLyrics = this.parseLrcToText(lyrics.lyric);
                    globalState.addRecentlyPlayedSong({
                        name: track.name,
                        artist: track.artist.join(', '),
                        lyrics: cleanLyrics.slice(0, 500)
                    });
                    
                    // 记录歌曲和歌手到历史记录和禁止列表
                    recordSong(track.name, track.artist.join(', '));
                    for (const artistName of track.artist) {
                        addProhibitedArtist(artistName);
                    }
                }
            }

            // 执行下载 - 增加指数退避重试
            if (urlToDownload) {
                const MAX_RETRIES = 3;
                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        radioMonitor.log('DIRECTOR', `Downloading music (attempt ${attempt}/${MAX_RETRIES}): ${track.name}...`, 'info');

                        const response = await fetch(urlToDownload);
                        if (!response.ok) throw new Error(`Download failed: ${response.status}`);

                        const blob = await response.blob();
                        this.musicDataCache.set(block.search, blob);

                        radioMonitor.log('DIRECTOR', `✓ Music downloaded: ${track.name} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
                        break; // 成功，退出重试
                    } catch (err) {
                        if (attempt < MAX_RETRIES) {
                            const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
                            radioMonitor.log('DIRECTOR', `Download failed (attempt ${attempt}/${MAX_RETRIES}): ${block.search} - ${err}. Retry in ${delayMs}ms...`, 'warn');
                            await this.delay(delayMs);
                        } else {
                            radioMonitor.log('DIRECTOR', `✗ All retries failed: ${block.search} - ${err}`, 'error');
                        }
                    }
                }
            } else {
                radioMonitor.log('DIRECTOR', `✗ Failed to get URL for: ${track.name}`, 'warn');
            }

        } catch (error) {
            radioMonitor.log('DIRECTOR', `✗ Music preload failed: ${block.search} - ${error}`, 'error');
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
    private async executeTimeline(sessionId?: number): Promise<void> {
        if (!this.context) return;

        const { timeline } = this.context;

        // Session 有效性检查
        const isValidSession = () => sessionId === undefined || sessionId === this.currentSessionId;

        while (this.isRunning && isValidSession() && this.context.currentBlockIndex < timeline.blocks.length) {
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

            // 🔥 新增：播放前确认块已准备好
            if (!this.isBlockPrepared(block)) {
                radioMonitor.log('DIRECTOR', `Block ${this.context.currentBlockIndex} not ready, waiting...`, 'warn');

                const maxWait = 10000; // 最多等10秒
                const startWait = Date.now();

                while (!this.isBlockPrepared(block) && Date.now() - startWait < maxWait) {
                    await this.delay(500);
                }

                if (!this.isBlockPrepared(block)) {
                    radioMonitor.log('DIRECTOR', `Block ${this.context.currentBlockIndex} timeout, skipping`, 'error');
                    if (!this.skipRequested) {
                        this.context.currentBlockIndex++;
                    }
                    continue;
                }
            }

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

                // 后备：触发预加载检查（主要由后台 worker 持续处理）
                // 这里作为额外保险，确保播放时缓冲区不会意外为空
            }
        }

        // 节目完整播放完成，记录到历史
        if (this.context && this.context.currentBlockIndex >= timeline.blocks.length) {
            const showType = writerAgent.getCurrentCast()?.showType || 'talk';
            recordShow(timeline.title || 'Untitled', showType, []);
            radioMonitor.log('DIRECTOR', `Show completed: ${timeline.title}`, 'info');
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
            const timeline = await writerAgent.generateTimeline(SHOW.PREGENERATE_DURATION);
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
        // 保存当前音乐音量状态
        const hadBackgroundMusic = block.backgroundMusic;

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

        // 恢复音乐音量（如果之前降低过）
        if (hadBackgroundMusic && hadBackgroundMusic.action === 'fade') {
            await audioMixer.fadeMusic(AUDIO.MUSIC_DEFAULT_VOLUME, AUDIO.FADE_DURATION_NORMAL);
            radioMonitor.log('DIRECTOR', 'Restored music volume after talk', 'trace');
        }
    }

    /**
     * 单说话人模式播放（逐句）- 带 lookahead 预生成
     */
    private async executeTalkBlockSingle(block: TalkBlock): Promise<void> {
        const scripts = block.scripts;

        // 先启动所有未缓存句子的预生成（并行）
        const lookaheadPromises: Map<number, Promise<void>> = new Map();

        for (let i = 0; i < scripts.length; i++) {
            const script = scripts[i];
            const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;

            if (!this.preparedAudio.has(audioId)) {
                // 启动预生成（不等待）
                const promise = (async () => {
                    try {
                        const result = await ttsAgent.generateSpeech(
                            script.text,
                            script.speaker,
                            { mood: script.mood, customStyle: script.voiceStyle, voiceName: script.voiceName }
                        );
                        if (result.success && result.audioData) {
                            this.preparedAudio.set(audioId, result.audioData);
                        }
                    } catch (e) {
                        console.warn('[Director] Lookahead TTS failed:', e);
                    }
                })();
                lookaheadPromises.set(i, promise);
            }
        }

        // 逐句播放
        for (let i = 0; i < scripts.length; i++) {
            const script = scripts[i];

            // 检测跳转请求，立即中断
            if (!this.isRunning || this.skipRequested) break;

            // 发出脚本开始事件
            radioMonitor.emitScript(script.speaker, script.text, block.id);

            const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;

            // 等待当前句子的预生成完成（如果还在进行中）
            const pendingPromise = lookaheadPromises.get(i);
            if (pendingPromise) {
                await pendingPromise;
            }

            const audioData = this.preparedAudio.get(audioId);

            if (audioData) {
                try {
                    await audioMixer.playVoice(audioData);
                } catch (e) {
                    console.warn('[Director] Voice playback failed, skipping:', e);
                }
            } else {
                // 实时生成（备选）- 如果预生成失败
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
        try {
            // 1. 先生成介绍词 TTS (但不播放)
            let introAudio: ArrayBuffer | null = null;
            if (block.intro) {
                try {
                    const result = await ttsAgent.generateSpeech(
                        block.intro.text,
                        block.intro.speaker,
                        { mood: block.intro.mood }
                    );
                    if (result.success && result.audioData) {
                        introAudio = result.audioData;
                    }
                } catch (e) {
                    console.warn('[Director] Intro TTS generation failed:', e);
                }
            }

            const playIntroOverlay = async () => {
                if (introAudio) {
                    await audioMixer.overlayVoice(introAudio);
                }
            };

            // 2. 优先播放已下载的 Blob（最稳定，不受 URL TTL 影响）
            const cachedData = this.musicDataCache.get(block.search);
            if (cachedData) {
                const blobUrl = URL.createObjectURL(cachedData);
                radioMonitor.log('DIRECTOR', `Playing cached music (Blob): ${block.search}`, 'info');

                const result = await audioMixer.playMusic(blobUrl, {
                    fadeIn: block.fadeIn,
                    format: 'mp3',
                    html5: true
                });

                if (result.success) {
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);

                    await playIntroOverlay();
                    globalState.addTrack(block.search);

                    if (block.duration) {
                        await this.delay(block.duration * 1000);
                        await audioMixer.fadeMusic(0, 2000);
                        audioMixer.stopMusic();
                        audioMixer.setMusicVolume(AUDIO.MUSIC_DEFAULT_VOLUME);  // 重置音量到默认值
                    }

                    return;
                }

                radioMonitor.log('DIRECTOR', `Cached music playback failed: ${block.search} - ${result.error}`, 'error');
                URL.revokeObjectURL(blobUrl);
                radioMonitor.log('DIRECTOR', `Fallback to live search: ${block.search}`, 'warn');
            } else {
                radioMonitor.log('DIRECTOR', `Music not cached, fallback to live search: ${block.search}`, 'warn');
            }

            // 3. 降级：实时搜索/刷新 URL 并播放
            let track = this.musicCache.get(block.search);
            if (!track) {
                radioMonitor.log('DIRECTOR', `Searching music (fallback): ${block.search}`, 'info');
                const tracks = await searchMusic(block.search);
                if (tracks.length === 0) {
                    radioMonitor.log('DIRECTOR', `Music not found: ${block.search}`, 'warn');
                    return;
                }
                track = tracks[0];
                this.musicCache.set(block.search, track);
            }

            const url = await getMusicUrl(track.id, 320, track.source);
            if (!url) {
                radioMonitor.log('DIRECTOR', `Failed to get music URL (fallback): ${block.search}`, 'error');
                return;
            }

            this.musicUrlCache.set(block.search, { url, cachedAt: Date.now() });
            radioMonitor.log('DIRECTOR', `Playing music (live): ${track.name}`, 'info');

            const playResult = await audioMixer.playMusic(url, {
                fadeIn: block.fadeIn ?? 2000
            });

            if (!playResult.success) {
                radioMonitor.log('DIRECTOR', `Live music playback failed: ${block.search} - ${playResult.error}`, 'error');
                return;
            }

            await playIntroOverlay();
            globalState.addTrack(block.search);

            if (block.duration) {
                await this.delay(block.duration * 1000);
                await audioMixer.fadeMusic(0, 2000);
                audioMixer.stopMusic();
                audioMixer.setMusicVolume(AUDIO.MUSIC_DEFAULT_VOLUME);  // 重置音量到默认值
            }
        } catch (err) {
            radioMonitor.log('DIRECTOR', `executeMusicBlock error: ${err}`, 'error');
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
