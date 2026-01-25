/**
 * Director Agent - 导演 Agent
 * 节目调度、音乐控制、时间线执行
 * 支持上下文记忆和双缓冲预加载
 * 
 * 重构版本：使用模块化拆分
 */

import {
    ShowTimeline,
    TimelineBlock,
    TalkBlock,
    MusicBlock,
    MusicControlBlock,
    PlayerState
} from '@shared/types/radio-core';
import { writerAgent } from '@features/content/lib/writer-agent';
import { ttsAgent } from '@features/tts/lib/tts-agent';
import { audioMixer } from '@shared/services/audio-service/mixer';
import { searchMusic, getMusicUrl, IGDMusicTrack } from '@features/music-search/lib/gd-music-service';
import { globalState } from '@shared/stores/global-state';
import { radioMonitor } from '@shared/services/monitor-service';
import { getSettings } from '@shared/services/storage-service/settings';
import { saveSession } from '@shared/services/storage-service/session';
import { mailQueue } from '@features/feedback/lib/mail-queue';
import { AUDIO, SHOW, AGENT } from '@shared/utils/constants';
import { timeAnnouncementService } from '@features/time-announcement/lib/announcer';
import { recordShow } from '@features/history-tracking/lib/history-manager';

// ================== 导入模块 ==================
import { DirectorState, ExecutionContext, createDefaultState } from './director-types';
import * as PlaybackController from './playback-controller';
import * as PreloadManager from './preload-manager';
import * as WarmupContent from './warmup-content';
import * as TalkExecutor from './talk-executor';
import * as MusicExecutor from './music-executor';

// ================== Director Agent Class ==================

export class DirectorAgent {
    // 使用共享状态对象
    private state: DirectorState = createDefaultState();

    // 后台预加载 worker
    private preloadWorkerRef: { current: ReturnType<typeof setInterval> | null } = { current: null };

    // ================== 公开方法 ==================

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
        if (this.state.isRunning) {
            console.warn('Show already running');
            return;
        }

        this.state.isRunning = true;
        this.state.currentSessionId++;
        const sessionId = this.state.currentSessionId;
        ttsAgent.reset();

        if (options) {
            this.state.context = {
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

        timeAnnouncementService.start();
        await this.runShowLoop(options?.theme, options?.userRequest, sessionId);
    }

    /**
     * 停止节目
     */
    stopShow(): void {
        this.state.isRunning = false;
        PreloadManager.stopPreloadWorker(this.preloadWorkerRef);
        audioMixer.stopAll();
        ttsAgent.abort();
        timeAnnouncementService.stop();
        this.state.context = null;
        this.state.preparedAudio.clear();
        this.state.musicDataCache.clear();
        this.state.musicCoverCache.clear();
        this.state.isPreparing.clear();
        this.state.nextTimeline = null;
        this.state.isPreparingNext = false;
        globalState.reset();
        radioMonitor.updateStatus('DIRECTOR', 'IDLE', 'Disconnected');
        radioMonitor.updateStatus('WRITER', 'IDLE', 'Disconnected');
        radioMonitor.updateStatus('TTS', 'IDLE', 'Disconnected');
        radioMonitor.updateStatus('MIXER', 'IDLE', 'Disconnected');
    }

    // 委托给 PlaybackController 模块
    pauseShow(): void { PlaybackController.pauseShow(this.state); }
    resumeShow(): void { PlaybackController.resumeShow(this.state); }
    skipToNext(): void { PlaybackController.skipToNext(this.state); }
    skipToPrevious(): void { PlaybackController.skipToPrevious(this.state); }
    skipToBlock(index: number): void { PlaybackController.skipToBlock(this.state, index); }
    getPlaybackInfo() { return PlaybackController.getPlaybackInfo(this.state); }

    /**
     * 获取当前状态
     */
    getState(): PlayerState {
        if (!this.state.context) {
            return {
                isPlaying: false,
                currentBlockId: null,
                musicState: {
                    isPlaying: false,
                    currentTrack: null,
                    volume: 1
                },
                voiceState: {
                    isPlaying: false,
                    currentScriptId: null
                },
                queue: {
                    pending: 0,
                    ready: 0,
                    generating: 0
                }
            };
        }

        const { timeline, currentBlockIndex } = this.state.context;
        const currentBlock = timeline.blocks[currentBlockIndex];
        const preparedCount = PreloadManager.countPreparedBlocks(this.state, currentBlockIndex, timeline.blocks.length);

        return {
            isPlaying: this.state.isRunning,
            currentBlockId: currentBlock?.id || null,
            musicState: {
                isPlaying: currentBlock?.type === 'music',
                currentTrack: currentBlock?.type === 'music' ? (currentBlock as MusicBlock).search : null,
                volume: 1
            },
            voiceState: {
                isPlaying: currentBlock?.type === 'talk',
                currentScriptId: currentBlock?.id || null
            },
            queue: {
                pending: timeline.blocks.length - currentBlockIndex - preparedCount,
                ready: preparedCount,
                generating: this.state.isPreparing.size
            }
        };
    }

    // ================== 私有方法 ==================

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 内部主运行循环
     */
    private async runShowLoop(theme?: string, userRequest?: string, sessionId?: number): Promise<void> {
        console.log('[Director] Entering show loop... (session:', sessionId, ')');
        radioMonitor.updateStatus('DIRECTOR', 'READY', 'Ready to start loop');

        let nextTimeline: ShowTimeline | null = null;
        let nextTimelineReady = false;
        let isFirstRun = true;

        const isValidSession = () => sessionId === undefined || sessionId === this.state.currentSessionId;

        while (this.state.isRunning && isValidSession()) {
            try {
                let currentTimeline: ShowTimeline;

                if (isFirstRun) {
                    isFirstRun = false;

                    WarmupContent.playWarmupContent(() => this.searchAndPlayIntroMusic());
                    const timelinePromise = this.generateMainTimeline(theme, userRequest);

                    currentTimeline = await timelinePromise;
                    await this.setupTimeline(currentTimeline);
                    radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Preparing audio...');

                    const preloadCount = getSettings().preloadBlockCount;
                    const preparePromise = this.prepareBlocks(0, preloadCount);

                    await PreloadManager.waitForFirstBlockReady(
                        this.state, currentTimeline, 15000, (ms) => this.delay(ms)
                    );

                    await audioMixer.fadeMusic(0, 1500);
                    audioMixer.stopAll();
                    audioMixer.setMusicVolume(AUDIO.MUSIC_DEFAULT_VOLUME);
                    await this.delay(300);

                    preparePromise.catch(err => {
                        radioMonitor.log('DIRECTOR', `Background prepare warning: ${err}`, 'warn');
                    });
                } else if (nextTimeline && nextTimelineReady) {
                    radioMonitor.log('DIRECTOR', 'Using pre-generated timeline', 'info');
                    currentTimeline = nextTimeline;
                    nextTimeline = null;
                    nextTimelineReady = false;

                    // 确保当前音频完全停止
                    audioMixer.stopAll();
                    await this.delay(200);

                    // 清空旧节目的 TTS 缓存，防止音频串用
                    this.state.preparedAudio.clear();
                    radioMonitor.log('DIRECTOR', 'Cleared TTS cache for new program', 'trace');

                    radioMonitor.log('DIRECTOR', 'Playing transition music...', 'info');
                    await WarmupContent.playTransitionMusic((ms) => this.delay(ms));
                    await this.delay(800);  // 增加缓冲时间

                    await this.setupTimeline(currentTimeline);
                    radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Preparing audio...');
                    const preloadCount = getSettings().preloadBlockCount;
                    await this.prepareBlocks(0, preloadCount);
                } else {
                    radioMonitor.log('DIRECTOR', 'Waiting for timeline generation...', 'warn');
                    await audioMixer.fadeMusic(0, 1000);
                    audioMixer.stopMusic();
                    audioMixer.setMusicVolume(AUDIO.MUSIC_DEFAULT_VOLUME);

                    // 清空旧节目的 TTS 缓存，防止音频串用
                    this.state.preparedAudio.clear();

                    const pendingMail = mailQueue.getNext();
                    currentTimeline = await this.generateMainTimeline(undefined, pendingMail?.content);

                    await this.setupTimeline(currentTimeline);
                    radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Preparing audio...');
                    const preloadCount = getSettings().preloadBlockCount;
                    await this.prepareBlocks(0, preloadCount);
                }

                // 启动后台预加载
                this.startPreloadWorker();

                const executePromise = this.executeTimeline(sessionId);

                // 并行准备下一期
                (async () => {
                    const halfwayDelay = Math.max(AGENT.HALFWAY_DELAY_MIN_MS, (currentTimeline.blocks.length * 3000) / 2);
                    await this.delay(halfwayDelay);

                    if (!this.state.isRunning || !isValidSession()) return;

                    radioMonitor.log('DIRECTOR', 'Pre-generating next timeline...', 'info');
                    const pendingMail = mailQueue.getNext();
                    nextTimeline = await this.generateMainTimeline(undefined, pendingMail?.content);

                    if (!this.state.isRunning || !isValidSession() || !nextTimeline) return;

                    await this.setupTimeline(nextTimeline, false);
                    const halfBlocks = Math.ceil(nextTimeline.blocks.length / 2);
                    await this.prepareBlocksForTimeline(nextTimeline, 0, halfBlocks);

                    nextTimelineReady = true;
                    radioMonitor.log('DIRECTOR', 'Next timeline ready', 'info');
                })();

                await executePromise;

            } catch (error) {
                console.error('[Director] Loop error:', error);
                radioMonitor.updateStatus('DIRECTOR', 'ERROR', String(error));
                this.state.context?.onError?.(error as Error);
                await this.delay(5000);
            }
        }

        radioMonitor.updateStatus('DIRECTOR', 'IDLE', 'Show ended');
        console.log('[Director] Show loop ended.');
    }

    private async generateMainTimeline(theme?: string, userRequest?: string): Promise<ShowTimeline> {
        const duration = SHOW.MAIN_DURATION;
        console.log(`[Director] Generating new timeline (${duration}s)...`);
        radioMonitor.updateStatus('DIRECTOR', 'BUSY', 'Generating timeline...');
        return writerAgent.generateTimeline(duration, theme, userRequest);
    }

    private async setupTimeline(timeline: ShowTimeline, broadcast: boolean = true): Promise<void> {
        console.log('[Director] New timeline generated:', timeline.id, 'with', timeline.blocks.length, 'blocks');

        if (broadcast) {
            radioMonitor.emitTimeline(timeline);
        }

        const cast = writerAgent.getCurrentCast();
        if (cast) {
            ttsAgent.setActiveCast(cast);
        }

        if (broadcast) {
            if (this.state.context) {
                this.state.context.timeline = timeline;
                this.state.context.currentBlockIndex = 0;
                this.state.context.onTimelineReady?.(timeline);
            } else {
                this.state.context = {
                    timeline,
                    currentBlockIndex: 0,
                    isPaused: false,
                };
            }
        }
    }

    private async searchAndPlayIntroMusic(): Promise<string | null> {
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

    private startPreloadWorker(): void {
        PreloadManager.startPreloadWorker(
            this.state,
            (block) => this.prepareBlockAsync(block),
            this.preloadWorkerRef
        );
    }

    private async prepareBlocks(startIndex: number, count: number): Promise<void> {
        if (!this.state.context) return;

        const { timeline } = this.state.context;
        const endIndex = Math.min(startIndex + count, timeline.blocks.length);
        const preparePromises: Promise<void>[] = [];

        for (let i = startIndex; i < endIndex; i++) {
            const block = timeline.blocks[i];
            if (block.type === 'talk') {
                preparePromises.push(TalkExecutor.prepareTalkBlock(this.state, block));
            } else if (block.type === 'music') {
                preparePromises.push(MusicExecutor.prepareMusicBlock(this.state, block as MusicBlock, (ms) => this.delay(ms)));
            }
        }

        await Promise.all(preparePromises);
    }

    private async prepareBlocksForTimeline(timeline: ShowTimeline, startIndex: number, count: number): Promise<void> {
        const endIndex = Math.min(startIndex + count, timeline.blocks.length);
        const preparePromises: Promise<void>[] = [];

        for (let i = startIndex; i < endIndex; i++) {
            const block = timeline.blocks[i];
            if (block.type === 'talk') {
                preparePromises.push(TalkExecutor.prepareTalkBlock(this.state, block));
            } else if (block.type === 'music') {
                preparePromises.push(MusicExecutor.prepareMusicBlock(this.state, block as MusicBlock, (ms) => this.delay(ms)));
            }
        }

        await Promise.all(preparePromises);
    }

    private async prepareBlockAsync(block: TimelineBlock): Promise<void> {
        try {
            if (block.type === 'talk') {
                await TalkExecutor.prepareTalkBlock(this.state, block as TalkBlock);
            } else if (block.type === 'music') {
                await MusicExecutor.prepareMusicBlock(this.state, block as MusicBlock, (ms) => this.delay(ms));
            }
        } catch (error) {
            console.error(`[Preloader] Failed to prepare block ${block.id}:`, error);
        }
    }

    private async executeTimeline(sessionId?: number): Promise<void> {
        if (!this.state.context) return;

        const { timeline } = this.state.context;
        const isValidSession = () => sessionId === undefined || sessionId === this.state.currentSessionId;

        while (this.state.isRunning && isValidSession() && this.state.context.currentBlockIndex < timeline.blocks.length) {
            if (this.state.skipRequested) {
                this.state.skipRequested = false;
                if (this.state.targetBlockIndex >= 0 && this.state.targetBlockIndex < timeline.blocks.length) {
                    this.state.context.currentBlockIndex = this.state.targetBlockIndex;
                    this.state.targetBlockIndex = -1;
                    console.log('[Director] Jumped to block:', this.state.context.currentBlockIndex);
                    const preloadCount = getSettings().preloadBlockCount;
                    await this.prepareBlocks(this.state.context.currentBlockIndex, preloadCount);
                }
            }

            while (this.state.context.isPaused && this.state.isRunning && !this.state.skipRequested) {
                await this.delay(100);
            }

            if (!this.state.isRunning) break;
            if (this.state.skipRequested) continue;
            if (!this.state.context) break;

            const block = timeline.blocks[this.state.context.currentBlockIndex];

            if (!PreloadManager.isBlockPrepared(this.state, block)) {
                radioMonitor.log('DIRECTOR', `Block ${this.state.context.currentBlockIndex} not ready, waiting...`, 'warn');

                const maxWait = 10000;
                const startWait = Date.now();

                while (!PreloadManager.isBlockPrepared(this.state, block) && Date.now() - startWait < maxWait) {
                    await this.delay(500);
                }

                if (!PreloadManager.isBlockPrepared(this.state, block)) {
                    radioMonitor.log('DIRECTOR', `Block ${this.state.context.currentBlockIndex} timeout, skipping`, 'error');
                    if (!this.state.skipRequested) {
                        this.state.context.currentBlockIndex++;
                    }
                    continue;
                }
            }

            this.state.context.onBlockStart?.(block, this.state.context.currentBlockIndex);
            radioMonitor.emitScript(block.type === 'talk' ? 'host1' : 'system', `Playing: ${block.type}`, block.id);

            try {
                await this.executeBlock(block);

                if (!this.state.skipRequested && this.state.context) {
                    this.state.context.onBlockEnd?.(block);
                }
            } catch (error) {
                if ((error as Error).name === 'AbortError') {
                    console.log('[Director] Request aborted');
                    break;
                }
                console.error('Block execution error:', error);
                if (this.state.context) {
                    this.state.context.onError?.(error as Error, block);
                }
            }

            if (!this.state.context) break;

            if (!this.state.skipRequested) {
                this.state.context.currentBlockIndex++;

                saveSession({
                    id: timeline.id,
                    timeline: timeline,
                    currentBlockIndex: this.state.context.currentBlockIndex,
                    playbackPosition: 0
                });
            }
        }

        if (this.state.context && this.state.context.currentBlockIndex >= timeline.blocks.length) {
            const showType = writerAgent.getCurrentCast()?.showType || 'talk';
            recordShow(timeline.title || 'Untitled', showType, []);
            radioMonitor.log('DIRECTOR', `Show completed: ${timeline.title}`, 'info');
        }
    }

    private async executeBlock(block: TimelineBlock): Promise<void> {
        switch (block.type) {
            case 'talk':
                await TalkExecutor.executeTalkBlock(this.state, block as TalkBlock, (ms) => this.delay(ms));
                break;
            case 'music':
                await MusicExecutor.executeMusicBlock(this.state, block as MusicBlock, (ms) => this.delay(ms));
                break;
            case 'music_control':
                await MusicExecutor.executeMusicControlBlock(block as MusicControlBlock, (ms) => this.delay(ms));
                break;
            case 'silence':
                await this.delay(block.duration);
                break;
        }
    }
}

// 单例导出
export const directorAgent = new DirectorAgent();
