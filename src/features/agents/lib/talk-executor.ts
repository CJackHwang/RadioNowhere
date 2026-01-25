/**
 * Talk Executor - 对话执行模块
 * 处理 TalkBlock 的准备和执行
 */

import { TalkBlock } from '@shared/types/radio-core';
import { ttsAgent } from '@features/tts/lib/tts-agent';
import { audioMixer } from '@shared/services/audio-service/mixer';
import { radioMonitor } from '@shared/services/monitor-service';
import { globalState } from '@shared/stores/global-state';
import { getSettings } from '@shared/services/storage-service/settings';
import { AUDIO } from '@shared/utils/constants';
import { DirectorState } from './director-types';

/**
 * 预处理说话块（智能选择批量/分开 TTS）
 */
export async function prepareTalkBlock(
    state: DirectorState,
    block: TalkBlock
): Promise<void> {
    const settings = getSettings();
    const uniqueSpeakers = new Set(block.scripts.map(s => s.speaker));

    if (settings.ttsProvider === 'gemini' && uniqueSpeakers.size <= 2 && block.scripts.length >= 1) {
        await prepareTalkBlockBatched(state, block);
    } else {
        await prepareTalkBlockSingle(state, block);
    }
}

/**
 * 批量 TTS 预处理（Gemini 专用）
 */
export async function prepareTalkBlockBatched(
    state: DirectorState,
    block: TalkBlock
): Promise<void> {
    const batchAudioId = `${block.id}-batch`;
    if (state.preparedAudio.has(batchAudioId)) return;

    try {
        const result = await ttsAgent.generateBatchedSpeech(
            block.scripts.map(s => ({
                speaker: s.speaker,
                text: s.text,
                voiceName: s.voiceName,
                mood: s.mood
            }))
        );

        if (result.success && result.audioData) {
            state.preparedAudio.set(batchAudioId, result.audioData);
        }
    } catch (error) {
        console.error('Batched TTS preparation failed:', error);
        await prepareTalkBlockSingle(state, block);
    }
}

/**
 * 单句 TTS 预处理
 */
export async function prepareTalkBlockSingle(
    state: DirectorState,
    block: TalkBlock
): Promise<void> {
    const ttsPromises = block.scripts.map(async (script) => {
        const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;
        if (state.preparedAudio.has(audioId)) return;

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
                state.preparedAudio.set(audioId, result.audioData);
            }
        } catch (error) {
            console.error('TTS preparation failed:', error);
        }
    });
    await Promise.all(ttsPromises);
}

/**
 * 执行说话块
 */
export async function executeTalkBlock(
    state: DirectorState,
    block: TalkBlock,
    delay: (ms: number) => Promise<void>
): Promise<void> {
    const hadBackgroundMusic = block.backgroundMusic;

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

    const batchAudioId = `${block.id}-batch`;
    const batchAudioData = state.preparedAudio.get(batchAudioId);

    if (batchAudioData) {
        radioMonitor.log('DIRECTOR', `Playing batched audio for ${block.scripts.length} lines`, 'info');

        for (const script of block.scripts) {
            radioMonitor.emitScript(script.speaker, script.text, block.id);
        }

        try {
            await audioMixer.playVoice(batchAudioData);
        } catch (e) {
            console.warn('[Director] Batched voice playback failed:', e);
        }

        for (const script of block.scripts) {
            globalState.addTopic(script.text.slice(0, 50), script.speaker);
        }
    } else {
        await executeTalkBlockSingle(state, block, delay);
    }

    if (hadBackgroundMusic) {
        if (hadBackgroundMusic.action === 'fade') {
            await audioMixer.fadeMusic(AUDIO.MUSIC_DEFAULT_VOLUME, AUDIO.FADE_DURATION_NORMAL);
            radioMonitor.log('DIRECTOR', 'Restored music volume after talk', 'trace');
        } else if (hadBackgroundMusic.action === 'pause') {
            audioMixer.resumeMusic();
            radioMonitor.log('DIRECTOR', 'Resumed music after talk', 'trace');
        }
    }
}

/**
 * 逐句播放（带 lookahead 预生成）
 */
export async function executeTalkBlockSingle(
    state: DirectorState,
    block: TalkBlock,
    delay: (ms: number) => Promise<void>
): Promise<void> {
    const scripts = block.scripts;
    const lookaheadPromises: Map<number, Promise<void>> = new Map();

    for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;

        if (!state.preparedAudio.has(audioId)) {
            const promise = (async () => {
                try {
                    const result = await ttsAgent.generateSpeech(
                        script.text,
                        script.speaker,
                        { mood: script.mood, customStyle: script.voiceStyle, voiceName: script.voiceName }
                    );
                    if (result.success && result.audioData) {
                        state.preparedAudio.set(audioId, result.audioData);
                    }
                } catch (e) {
                    console.warn('[Director] Lookahead TTS failed:', e);
                }
            })();
            lookaheadPromises.set(i, promise);
        }
    }

    for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];

        if (!state.isRunning || state.skipRequested) break;

        radioMonitor.emitScript(script.speaker, script.text, block.id);

        const audioId = `${block.id}-${script.speaker}-${script.text.slice(0, 20)}`;
        const pendingPromise = lookaheadPromises.get(i);
        if (pendingPromise) {
            await pendingPromise;
        }

        const audioData = state.preparedAudio.get(audioId);

        if (audioData) {
            try {
                await audioMixer.playVoice(audioData);
            } catch (e) {
                console.warn('[Director] Voice playback failed, skipping:', e);
            }
        } else {
            try {
                const result = await ttsAgent.generateSpeech(
                    script.text,
                    script.speaker,
                    { mood: script.mood, customStyle: script.voiceStyle, voiceName: script.voiceName }
                );
                if (result.success && result.audioData) {
                    await audioMixer.playVoice(result.audioData);
                }
            } catch (e) {
                console.warn('[Director] TTS error, continuing:', e);
            }
        }

        if (script.pause) {
            await delay(script.pause);
        }

        globalState.addTopic(script.text.slice(0, 50), script.speaker);
    }
}
