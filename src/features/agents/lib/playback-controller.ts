/**
 * Playback Controller - 播放控制模块
 * 处理暂停、继续、跳转等播放控制操作
 */

import { audioMixer } from '@shared/services/audio-service/mixer';
import { radioMonitor } from '@shared/services/monitor-service';
import { DirectorState } from './director-types';

/**
 * 暂停节目
 */
export function pauseShow(state: DirectorState): void {
    if (state.context) {
        state.context.isPaused = true;
        audioMixer.pauseAll();
    }
}

/**
 * 继续节目
 */
export function resumeShow(state: DirectorState): void {
    if (state.context) {
        state.context.isPaused = false;
        audioMixer.resumeAll();
    }
}

/**
 * 跳到下一段
 */
export function skipToNext(state: DirectorState): void {
    if (!state.context) return;

    const { timeline } = state.context;
    const nextIndex = state.context.currentBlockIndex + 1;

    if (nextIndex < timeline.blocks.length) {
        state.skipRequested = true;
        state.targetBlockIndex = nextIndex;
        audioMixer.stopAll();
        console.log('[Director] Skip to next:', nextIndex);
    }
}

/**
 * 跳到上一段
 */
export function skipToPrevious(state: DirectorState): void {
    if (!state.context) return;

    const prevIndex = state.context.currentBlockIndex - 1;

    if (prevIndex >= 0) {
        state.skipRequested = true;
        state.targetBlockIndex = prevIndex;
        audioMixer.stopAll();
        console.log('[Director] Skip to previous:', prevIndex);
    }
}

/**
 * 跳到指定段落
 */
export function skipToBlock(state: DirectorState, index: number): void {
    if (!state.context) {
        console.log('[Director] skipToBlock: no context');
        return;
    }

    const { timeline } = state.context;

    if (index >= 0 && index < timeline.blocks.length) {
        console.log('[Director] Skip requested to block:', index, 'current:', state.context.currentBlockIndex);

        state.skipRequested = true;
        state.targetBlockIndex = index;

        // 如果暂停中，自动恢复播放
        if (state.context.isPaused) {
            state.context.isPaused = false;
            radioMonitor.log('DIRECTOR', 'Resuming from pause for skip', 'info');
        }

        // 立即停止所有音频，避免冲突
        audioMixer.stopAll();

        // Immediately emit script event for the target block to update UI state
        // This ensures UI is in sync with the audio system
        const targetBlock = timeline.blocks[index];
        if (targetBlock) {
            radioMonitor.emitScript(
                'system',
                `Jumping to: ${targetBlock.type}`,
                targetBlock.id
            );
        }

        radioMonitor.log('DIRECTOR', `Jumping to block ${index}`, 'info');
    }
}

/**
 * 获取当前播放信息
 */
export function getPlaybackInfo(state: DirectorState): { current: number; total: number } | null {
    if (!state.context) return null;
    return {
        current: state.context.currentBlockIndex,
        total: state.context.timeline.blocks.length
    };
}
