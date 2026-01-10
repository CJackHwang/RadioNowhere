/**
 * Audio Mixer - 多轨音频控制器
 * 使用 Web Audio API 实现音乐+语音叠加播放
 */

import { Howl, Howler } from 'howler';

// ================== Types ==================

interface AudioTrackState {
    isPlaying: boolean;
    volume: number;
    currentSource: string | null;
}

// ================== PCM to WAV Conversion ==================

/**
 * 将 Gemini TTS 返回的 PCM 数据转换为 WAV 格式
 * Gemini 返回: audio/L16;codec=pcm;rate=24000 (16-bit signed PCM, 24kHz, mono)
 */
function pcmToWav(pcmData: ArrayBuffer, sampleRate = 24000): ArrayBuffer {
    const numChannels = 1;  // Mono
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.byteLength;

    // WAV header is 44 bytes
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);           // Chunk size
    view.setUint16(20, 1, true);            // Audio format (1 = PCM)
    view.setUint16(22, numChannels, true);  // Num channels
    view.setUint32(24, sampleRate, true);   // Sample rate
    view.setUint32(28, byteRate, true);     // Byte rate
    view.setUint16(32, blockAlign, true);   // Block align
    view.setUint16(34, bitsPerSample, true);// Bits per sample

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Copy PCM data
    const pcmView = new Uint8Array(pcmData);
    const wavView = new Uint8Array(buffer);
    wavView.set(pcmView, 44);

    return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

// ================== Audio Mixer Class ==================

export class AudioMixer {
    private musicHowl: Howl | null = null;
    private voiceHowl: Howl | null = null;

    private musicVolume = 0.7;
    private voiceVolume = 1.0;
    private masterVolume = 0.8;

    private fadeInterval: NodeJS.Timeout | null = null;

    constructor() {
        Howler.volume(this.masterVolume);
    }

    // ================== 音乐控制 ==================

    /**
     * 播放音乐
     */
    async playMusic(url: string, options?: { fadeIn?: number }): Promise<void> {
        return new Promise((resolve, reject) => {
            // 停止当前音乐
            if (this.musicHowl) {
                this.musicHowl.unload();
            }

            const startVolume = options?.fadeIn ? 0 : this.musicVolume;

            this.musicHowl = new Howl({
                src: [url],
                html5: true,
                volume: startVolume,
                onload: () => {
                    if (options?.fadeIn) {
                        this.fadeMusic(this.musicVolume, options.fadeIn);
                    }
                    resolve();
                },
                onloaderror: (_, error) => {
                    console.error('Music load error:', error);
                    reject(error);
                },
                onend: () => {
                    // 音乐播放结束
                }
            });

            this.musicHowl.play();
        });
    }

    /**
     * 暂停音乐
     */
    pauseMusic(): void {
        this.musicHowl?.pause();
    }

    /**
     * 继续播放音乐
     */
    resumeMusic(): void {
        this.musicHowl?.play();
    }

    /**
     * 停止音乐
     */
    stopMusic(): void {
        this.musicHowl?.stop();
        this.musicHowl?.unload();
        this.musicHowl = null;
    }

    /**
     * 音乐淡入淡出
     */
    fadeMusic(targetVolume: number, duration: number): Promise<void> {
        return new Promise((resolve) => {
            if (!this.musicHowl) {
                resolve();
                return;
            }

            // 清除之前的 fade
            if (this.fadeInterval) {
                clearInterval(this.fadeInterval);
            }

            const startVolume = this.musicHowl.volume() as number;
            const volumeDiff = targetVolume - startVolume;
            const steps = duration / 50; // 每 50ms 一步
            const stepSize = volumeDiff / steps;
            let currentStep = 0;

            this.fadeInterval = setInterval(() => {
                currentStep++;
                const newVolume = startVolume + (stepSize * currentStep);
                this.musicHowl?.volume(Math.max(0, Math.min(1, newVolume)));

                if (currentStep >= steps) {
                    if (this.fadeInterval) clearInterval(this.fadeInterval);
                    this.musicHowl?.volume(targetVolume);
                    this.musicVolume = targetVolume;
                    resolve();
                }
            }, 50);
        });
    }

    /**
     * 设置音乐音量
     */
    setMusicVolume(volume: number): void {
        this.musicVolume = volume;
        this.musicHowl?.volume(volume);
    }

    /**
     * 获取音乐状态
     */
    getMusicState(): AudioTrackState {
        return {
            isPlaying: this.musicHowl?.playing() || false,
            volume: this.musicVolume,
            currentSource: null
        };
    }

    private voiceResolve: (() => void) | null = null; // 用于中断时立即 resolve

    /**
     * 播放语音（从 ArrayBuffer）
     * Gemini TTS 返回 PCM 格式，需要转换为 WAV
     */
    async playVoice(audioData: ArrayBuffer): Promise<void> {
        // 先确保上一个语音完全停止
        if (this.voiceHowl) {
            this.voiceHowl.stop(); // 触发 onstop 回调，resolve 上一个 Promise
            this.voiceHowl.unload();
            this.voiceHowl = null;
        }

        // 语音间隔小停顿（200ms）让过渡更自然
        await new Promise(r => setTimeout(r, 200));

        return new Promise((resolve, reject) => {
            // 将 PCM 转换为 WAV 格式
            const wavData = pcmToWav(audioData);
            const blob = new Blob([wavData], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);

            // 保存 resolve 以便 stopVoice 可以调用
            this.voiceResolve = () => {
                URL.revokeObjectURL(url);
                resolve();
            };

            this.voiceHowl = new Howl({
                src: [url],
                format: ['wav'],
                volume: this.voiceVolume,
                onend: () => {
                    // 音频播完后增加 300ms 缓冲，防止末尾吞字
                    setTimeout(() => {
                        this.voiceResolve?.();
                        this.voiceResolve = null;
                    }, 300);
                },
                onstop: () => {
                    // 被 stop() 调用时也 resolve
                    this.voiceResolve?.();
                    this.voiceResolve = null;
                },
                onloaderror: (_, error) => {
                    URL.revokeObjectURL(url);
                    this.voiceResolve = null;
                    console.error('Voice load error:', error);
                    reject(error);
                }
            });

            this.voiceHowl.play();
        });
    }

    /**
     * 停止语音
     */
    stopVoice(): void {
        if (this.voiceHowl) {
            this.voiceHowl.stop(); // 这会触发 onstop 回调
            this.voiceHowl.unload();
            this.voiceHowl = null;
        }
    }

    /**
     * 设置语音音量
     */
    setVoiceVolume(volume: number): void {
        this.voiceVolume = volume;
        this.voiceHowl?.volume(volume);
    }

    // ================== 叠加播放 ==================

    /**
     * 叠加播放语音（在音乐上层）
     * 自动降低音乐音量，语音结束后恢复
     */
    async overlayVoice(
        audioData: ArrayBuffer,
        options?: {
            musicVolumeDuringVoice?: number;
            fadeDuration?: number;
        }
    ): Promise<void> {
        const {
            musicVolumeDuringVoice = 0.2,
            fadeDuration = 500
        } = options || {};

        // 1. 如果有音乐在播放，降低音量
        const hadMusic = this.musicHowl?.playing();
        const originalMusicVolume = this.musicVolume;

        if (hadMusic) {
            await this.fadeMusic(musicVolumeDuringVoice, fadeDuration);
        }

        // 2. 播放语音
        await this.playVoice(audioData);

        // 3. 恢复音乐音量
        if (hadMusic) {
            await this.fadeMusic(originalMusicVolume, fadeDuration);
        }
    }

    // ================== 全局控制 ==================

    /**
     * 设置主音量
     */
    setMasterVolume(volume: number): void {
        this.masterVolume = volume;
        Howler.volume(volume);
    }

    /**
     * 全部停止
     */
    stopAll(): void {
        this.stopMusic();
        this.stopVoice();
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
        }
    }

    /**
     * 全部暂停
     */
    pauseAll(): void {
        this.musicHowl?.pause();
        this.voiceHowl?.pause();
    }

    /**
     * 全部继续
     */
    resumeAll(): void {
        this.musicHowl?.play();
        this.voiceHowl?.play();
    }

    /**
     * 获取完整状态
     */
    getState(): { music: AudioTrackState; voice: AudioTrackState } {
        return {
            music: {
                isPlaying: this.musicHowl?.playing() || false,
                volume: this.musicVolume,
                currentSource: null
            },
            voice: {
                isPlaying: this.voiceHowl?.playing() || false,
                volume: this.voiceVolume,
                currentSource: null
            }
        };
    }

    /**
     * 搜索并播放音乐（便捷方法）
     */
    async playMusicFromSearch(keyword: string): Promise<boolean> {
        try {
            // 动态导入避免循环依赖
            const { getRandomTrack, getMusicUrl } = await import('./gdmusic_service');

            const track = await getRandomTrack(keyword);
            if (!track) {
                console.warn('[AudioMixer] No track found for:', keyword);
                return false;
            }

            const url = await getMusicUrl(track.id, 320, track.source);
            if (!url) {
                console.warn('[AudioMixer] Failed to get URL for:', track.name);
                return false;
            }

            await this.playMusic(url, { fadeIn: 1000 });
            console.log('[AudioMixer] Playing:', track.name, '-', track.artist.join(', '));
            return true;
        } catch (error) {
            console.error('[AudioMixer] playMusicFromSearch error:', error);
            return false;
        }
    }
}

// 单例导出
export const audioMixer = new AudioMixer();
