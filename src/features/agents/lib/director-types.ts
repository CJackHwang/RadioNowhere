/**
 * Director 共享类型定义
 */

import {
    ShowTimeline,
    TimelineBlock,
    PlayerState
} from '@shared/types/radio-core';
import { IGDMusicTrack } from '@features/music-search/lib/gd-music-service';

/**
 * 执行上下文 - 当前节目的状态
 */
export interface ExecutionContext {
    timeline: ShowTimeline;
    currentBlockIndex: number;
    isPaused: boolean;
    onStateChange?: (state: PlayerState) => void;
    onBlockStart?: (block: TimelineBlock, index: number) => void;
    onBlockEnd?: (block: TimelineBlock) => void;
    onError?: (error: Error, block?: TimelineBlock) => void;
    onTimelineReady?: (timeline: ShowTimeline) => void;
}

/**
 * Director 共享状态 - 在模块间传递
 */
export interface DirectorState {
    // 执行上下文
    context: ExecutionContext | null;
    isRunning: boolean;

    // Session 控制
    currentSessionId: number;
    skipRequested: boolean;
    targetBlockIndex: number;

    // 缓存
    preparedAudio: Map<string, ArrayBuffer>;
    musicCache: Map<string, IGDMusicTrack>;
    musicUrlCache: Map<string, { url: string; cachedAt: number }>;
    musicDataCache: Map<string, Blob>;
    musicCoverCache: Map<string, string>;  // search keyword -> cover URL
    isPreparing: Set<string>;

    // 双缓冲
    nextTimeline: ShowTimeline | null;
    isPreparingNext: boolean;

    // 常量
    MUSIC_URL_TTL_MS: number;
}

/**
 * 创建默认状态
 */
export function createDefaultState(): DirectorState {
    return {
        context: null,
        isRunning: false,
        currentSessionId: 0,
        skipRequested: false,
        targetBlockIndex: -1,
        preparedAudio: new Map(),
        musicCache: new Map(),
        musicUrlCache: new Map(),
        musicDataCache: new Map(),
        musicCoverCache: new Map(),
        isPreparing: new Set(),
        nextTimeline: null,
        isPreparingNext: false,
        MUSIC_URL_TTL_MS: 20 * 60 * 1000
    };
}
