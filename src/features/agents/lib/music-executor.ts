/**
 * Music Executor - 音乐执行模块
 * 处理 MusicBlock 的准备和执行
 */

import { MusicBlock, MusicControlBlock } from '@shared/types/radio-core';
import { ttsAgent } from '@features/tts/lib/tts-agent';
import { audioMixer } from '@shared/services/audio-service/mixer';
import { radioMonitor } from '@shared/services/monitor-service';
import { globalState } from '@shared/stores/global-state';
import { searchMusic, getMusicUrl, getLyrics, getAlbumArt, IGDMusicTrack } from '@features/music-search/lib/gd-music-service';
import { recordSong } from '@features/history-tracking/lib/history-manager';
import { addProhibitedArtist } from '@features/music-search/lib/diversity-manager';
import { AUDIO } from '@shared/utils/constants';
import { DirectorState } from './director-types';

/**
 * 解析 LRC 格式歌词为纯文本
 */
export function parseLrcToText(lrc: string): string {
    return lrc
        .split('\n')
        .map(line => line.replace(/\[\d{2}:\d{2}(\.\d+)?\]/g, '').trim())
        .filter(line => line.length > 0)
        .join('\n');
}

/**
 * 续期音乐 URL（如果即将过期）
 */
export async function renewMusicUrlIfNeeded(
    state: DirectorState,
    block: MusicBlock
): Promise<void> {
    const cached = state.musicUrlCache.get(block.search);
    if (!cached) return;

    const age = Date.now() - cached.cachedAt;
    const remainingMs = state.MUSIC_URL_TTL_MS - age;
    if (remainingMs >= 5 * 60 * 1000) return;

    const track = state.musicCache.get(block.search);
    if (!track) return;

    try {
        const newUrl = await getMusicUrl(track.id, 320, track.source);
        if (newUrl) {
            state.musicUrlCache.set(block.search, { url: newUrl, cachedAt: Date.now() });
            radioMonitor.log('DIRECTOR', `Music URL renewed: ${block.search}`, 'info');
        }
    } catch (err) {
        radioMonitor.log('DIRECTOR', `Failed to renew URL: ${err}`, 'warn');
    }
}

/**
 * 预处理音乐块
 */
export async function prepareMusicBlock(
    state: DirectorState,
    block: MusicBlock,
    delay: (ms: number) => Promise<void>
): Promise<void> {
    if (state.musicDataCache.has(block.search)) {
        radioMonitor.log('DIRECTOR', `Music cache hit (RAM): ${block.search}`, 'trace');
        return;
    }

    let cachedUrl = state.musicUrlCache.get(block.search);
    let urlToDownload = cachedUrl?.url;

    try {
        if (!state.musicCache.has(block.search)) {
            radioMonitor.log('DIRECTOR', `Searching music: ${block.search}`, 'info');
            const tracks = await searchMusic(block.search);
            if (tracks.length > 0) {
                state.musicCache.set(block.search, tracks[0]);
            } else {
                radioMonitor.log('DIRECTOR', `Music not found: ${block.search}`, 'warn');
                return;
            }
        }

        const track = state.musicCache.get(block.search)!;

        await renewMusicUrlIfNeeded(state, block);
        cachedUrl = state.musicUrlCache.get(block.search);
        urlToDownload = cachedUrl?.url;

        if (cachedUrl) {
            const age = Date.now() - cachedUrl.cachedAt;
            if (age >= state.MUSIC_URL_TTL_MS) {
                state.musicUrlCache.delete(block.search);
                urlToDownload = undefined;
                radioMonitor.log('DIRECTOR', `Music URL expired, re-fetching...`, 'info');
            }
        }

        if (!urlToDownload) {
            const [newUrl, lyrics, albumArt] = await Promise.all([
                getMusicUrl(track.id, 320, track.source),
                getLyrics(track.lyricId, track.source),
                getAlbumArt(track.picId, 500, track.source)
            ]);

            if (newUrl) {
                urlToDownload = newUrl;
                state.musicUrlCache.set(block.search, { url: newUrl, cachedAt: Date.now() });
            }

            // 缓存专辑封面 URL
            if (albumArt) {
                state.musicCoverCache.set(block.search, albumArt);
            }

            if (lyrics?.lyric) {
                const cleanLyrics = parseLrcToText(lyrics.lyric);
                globalState.addRecentlyPlayedSong({
                    name: track.name,
                    artist: track.artist.join(', '),
                    lyrics: cleanLyrics.slice(0, 500)
                });

                recordSong(track.name, track.artist.join(', '));
                for (const artistName of track.artist) {
                    addProhibitedArtist(artistName);
                }
            }
        }

        if (urlToDownload) {
            const MAX_RETRIES = 3;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    radioMonitor.log('DIRECTOR', `Downloading music (attempt ${attempt}/${MAX_RETRIES}): ${track.name}...`, 'info');

                    const response = await fetch(urlToDownload);
                    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

                    const blob = await response.blob();
                    state.musicDataCache.set(block.search, blob);

                    radioMonitor.log('DIRECTOR', `✓ Music downloaded: ${track.name} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
                    break;
                } catch (err) {
                    if (attempt < MAX_RETRIES) {
                        const delayMs = 1000 * Math.pow(2, attempt - 1);
                        radioMonitor.log('DIRECTOR', `Download failed (attempt ${attempt}/${MAX_RETRIES}): ${block.search} - ${err}. Retry in ${delayMs}ms...`, 'warn');
                        await delay(delayMs);
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
 * 执行音乐块
 */
export async function executeMusicBlock(
    state: DirectorState,
    block: MusicBlock,
    delay: (ms: number) => Promise<void>
): Promise<void> {
    try {
        // 1. 先生成介绍词 TTS
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

        // 2. 优先播放已下载的 Blob
        const cachedData = state.musicDataCache.get(block.search);
        if (cachedData) {
            const blobUrl = URL.createObjectURL(cachedData);
            radioMonitor.log('DIRECTOR', `Playing cached music (Blob): ${block.search}`, 'info');

            const result = await audioMixer.playMusic(blobUrl, {
                fadeIn: block.fadeIn ?? AUDIO.MUSIC_DEFAULT_FADE_IN,
                format: 'mp3',
                html5: true
            });

            if (result.success) {
                setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);

                // 发送带元数据的音乐播放事件
                const track = state.musicCache.get(block.search);
                const coverUrl = state.musicCoverCache.get(block.search) || null;
                if (track) {
                    radioMonitor.emitMusicScript(
                        track.name,
                        track.artist.join(', '),
                        track.album,
                        coverUrl,
                        block.id
                    );
                }

                await playIntroOverlay();
                globalState.addTrack(block.search);

                if (block.duration) {
                    await delay(block.duration * 1000);
                    await audioMixer.fadeMusic(0, 2000);
                    audioMixer.stopMusic();
                    audioMixer.setMusicVolume(AUDIO.MUSIC_DEFAULT_VOLUME);
                }
                return;
            }

            radioMonitor.log('DIRECTOR', `Cached music playback failed: ${block.search} - ${result.error}`, 'error');
            URL.revokeObjectURL(blobUrl);
            radioMonitor.log('DIRECTOR', `Fallback to live search: ${block.search}`, 'warn');
        } else {
            radioMonitor.log('DIRECTOR', `Music not cached, fallback to live search: ${block.search}`, 'warn');
        }

        // 3. 降级：实时搜索
        let track = state.musicCache.get(block.search);
        if (!track) {
            radioMonitor.log('DIRECTOR', `Searching music (fallback): ${block.search}`, 'info');
            const tracks = await searchMusic(block.search);
            if (tracks.length === 0) {
                radioMonitor.log('DIRECTOR', `Music not found: ${block.search}`, 'warn');
                return;
            }
            track = tracks[0];
            state.musicCache.set(block.search, track);
        }

        const url = await getMusicUrl(track.id, 320, track.source);
        if (!url) {
            radioMonitor.log('DIRECTOR', `Failed to get music URL (fallback): ${block.search}`, 'error');
            return;
        }

        state.musicUrlCache.set(block.search, { url, cachedAt: Date.now() });
        radioMonitor.log('DIRECTOR', `Playing music (live): ${track.name}`, 'info');

        const playResult = await audioMixer.playMusic(url, {
            fadeIn: block.fadeIn ?? AUDIO.MUSIC_DEFAULT_FADE_IN
        });

        if (!playResult.success) {
            radioMonitor.log('DIRECTOR', `Live music playback failed: ${block.search} - ${playResult.error}`, 'error');
            return;
        }

        // 发送带元数据的音乐播放事件
        let coverUrl = state.musicCoverCache.get(block.search) || null;
        // 如果还没有封面，尝试获取
        if (!coverUrl && track.picId) {
            try {
                coverUrl = await getAlbumArt(track.picId, 500, track.source);
                if (coverUrl) {
                    state.musicCoverCache.set(block.search, coverUrl);
                }
            } catch {
                // 忽略封面获取失败
            }
        }
        radioMonitor.emitMusicScript(
            track.name,
            track.artist.join(', '),
            track.album,
            coverUrl,
            block.id
        );

        await playIntroOverlay();
        globalState.addTrack(block.search);

        if (block.duration) {
            await delay(block.duration * 1000);
            await audioMixer.fadeMusic(0, 2000);
            audioMixer.stopMusic();
            audioMixer.setMusicVolume(AUDIO.MUSIC_DEFAULT_VOLUME);
        }
    } catch (err) {
        radioMonitor.log('DIRECTOR', `executeMusicBlock error: ${err}`, 'error');
    }
}

/**
 * 执行音乐控制块
 */
export async function executeMusicControlBlock(
    block: MusicControlBlock,
    delay: (ms: number) => Promise<void>
): Promise<void> {
    switch (block.action) {
        case 'pause':
            audioMixer.pauseMusic();
            break;
        case 'resume':
            audioMixer.resumeMusic();
            break;
        case 'fade_out':
            await audioMixer.fadeMusic(0, block.fadeDuration || 2000);
            break;
        case 'fade_in':
            await audioMixer.fadeMusic(block.targetVolume || 0.7, block.fadeDuration || 2000);
            break;
        case 'stop':
            audioMixer.stopMusic();
            break;
    }
}
