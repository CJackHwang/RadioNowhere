/**
 * GD Studio Music API Service
 * API Documentation: https://music.gdstudio.xyz
 * 
 * Source: netease (网易云音乐) - stable
 * Rate Limit: 50 requests per 5 minutes
 */

const API_BASE = "https://music-api.gdstudio.xyz/api.php";
const DEFAULT_SOURCE = "netease";

// 稳定音乐源（只使用这些）
const STABLE_SOURCES = ['netease', 'kuwo', 'joox'] as const;
type StableSource = typeof STABLE_SOURCES[number];

// ================== Interfaces ==================

export interface IGDMusicTrack {
    id: string;           // track_id for fetching URL
    name: string;         // song name
    artist: string[];     // artist list
    album: string;        // album name
    picId: string;        // for album art
    lyricId: string;      // for lyrics
    source: string;       // music source
}

export interface IGDLyrics {
    lyric: string;        // Original LRC lyrics
    tlyric?: string;      // Chinese translation (optional)
}

interface SearchAPIResponse {
    id: string;
    name: string;
    artist: string[];
    album: string;
    pic_id: string;
    lyric_id: string;
    source: string;
}

interface UrlAPIResponse {
    url: string;
    br: number;
    size: number;
}

interface PicAPIResponse {
    url: string;
}

interface LyricAPIResponse {
    lyric: string;
    tlyric?: string;
}

// ================== API Functions ==================

/**
 * Search for music tracks
 * @param keyword - Search keyword (song name, artist, album)
 * @param count - Number of results (default 10)
 * @param pages - Page number (default 1)
 * @param source - Music source (default netease)
 */
export async function searchMusic(
    keyword: string,
    count: number = 10,
    pages: number = 1,
    source: string = DEFAULT_SOURCE
): Promise<IGDMusicTrack[]> {
    try {
        const url = `${API_BASE}?types=search&source=${source}&name=${encodeURIComponent(keyword)}&count=${count}&pages=${pages}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error("GD Music Search Error:", response.status);
            return [];
        }

        const data: SearchAPIResponse[] = await response.json();

        if (!Array.isArray(data)) {
            console.warn("Unexpected search response format:", data);
            return [];
        }

        return data.map(track => ({
            id: track.id,
            name: track.name,
            artist: track.artist,
            album: track.album,
            picId: track.pic_id,
            lyricId: track.lyric_id,
            source: track.source
        }));
    } catch (error) {
        console.error("GD Music Search Error:", error);
        return [];
    }
}

/**
 * Get playable music URL
 * @param trackId - Track ID from search results
 * @param br - Bitrate: 128, 192, 320, 740, 999 (lossless)
 * @param source - Music source
 */
export async function getMusicUrl(
    trackId: string,
    br: 128 | 192 | 320 | 740 | 999 = 320,
    source: string = DEFAULT_SOURCE
): Promise<string | null> {
    try {
        const url = `${API_BASE}?types=url&source=${source}&id=${trackId}&br=${br}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error("GD Music URL Error:", response.status);
            return null;
        }

        const data: UrlAPIResponse = await response.json();
        return data.url || null;
    } catch (error) {
        console.error("GD Music URL Error:", error);
        return null;
    }
}

/**
 * Get album art URL
 * @param picId - Picture ID from search results
 * @param size - Image size: 300 (small) or 500 (large)
 * @param source - Music source
 */
export async function getAlbumArt(
    picId: string,
    size: 300 | 500 = 300,
    source: string = DEFAULT_SOURCE
): Promise<string | null> {
    try {
        const url = `${API_BASE}?types=pic&source=${source}&id=${picId}&size=${size}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error("GD Music Pic Error:", response.status);
            return null;
        }

        const data: PicAPIResponse = await response.json();
        return data.url || null;
    } catch (error) {
        console.error("GD Music Pic Error:", error);
        return null;
    }
}

/**
 * Get song lyrics in LRC format
 * @param lyricId - Lyric ID from search results
 * @param source - Music source
 */
export async function getLyrics(
    lyricId: string,
    source: string = DEFAULT_SOURCE
): Promise<IGDLyrics | null> {
    try {
        const url = `${API_BASE}?types=lyric&source=${source}&id=${lyricId}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error("GD Music Lyric Error:", response.status);
            return null;
        }

        const data: LyricAPIResponse = await response.json();

        if (!data.lyric) {
            return null;
        }

        return {
            lyric: data.lyric,
            tlyric: data.tlyric
        };
    } catch (error) {
        console.error("GD Music Lyric Error:", error);
        return null;
    }
}

/**
 * Get a random track from search results
 * Useful for AI-driven music selection
 */
export async function getRandomTrack(keyword: string): Promise<IGDMusicTrack | null> {
    const tracks = await searchMusic(keyword, 20);
    if (tracks.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * tracks.length);
    return tracks[randomIndex];
}

/**
 * Fetch complete track data including URL and album art
 */
export async function getCompleteTrackData(track: IGDMusicTrack): Promise<{
    track: IGDMusicTrack;
    url: string | null;
    albumArt: string | null;
    lyrics: IGDLyrics | null;
}> {
    const [url, albumArt, lyrics] = await Promise.all([
        getMusicUrl(track.id, 320, track.source),
        getAlbumArt(track.picId, 300, track.source),
        getLyrics(track.lyricId, track.source)
    ]);

    return { track, url, albumArt, lyrics };
}

/**
 * 搜索音乐并验证可播放
 * 只使用稳定音乐源，返回验证过可以播放的歌曲
 */
export async function searchMusicWithValidation(
    keyword: string,
    maxResults: number = 5
): Promise<{ track: IGDMusicTrack; url: string }[]> {
    const validatedTracks: { track: IGDMusicTrack; url: string }[] = [];

    // 依次尝试稳定音乐源
    for (const source of STABLE_SOURCES) {
        if (validatedTracks.length >= maxResults) break;

        try {
            const tracks = await searchMusic(keyword, 10, 1, source);

            // 验证每首歌曲是否可播放
            for (const track of tracks) {
                if (validatedTracks.length >= maxResults) break;

                const url = await getMusicUrl(track.id, 320, source);
                if (url && url.startsWith('http')) {
                    validatedTracks.push({ track, url });
                }
            }
        } catch (e) {
            console.warn(`Search failed for source ${source}:`, e);
        }
    }

    return validatedTracks;
}

// Debug helper - expose to window for browser console testing
if (typeof window !== 'undefined') {
    (window as unknown as { testGDMusic: object }).testGDMusic = {
        search: searchMusic,
        getUrl: getMusicUrl,
        getArt: getAlbumArt,
        getLyrics: getLyrics,
        getRandom: getRandomTrack,
        getComplete: getCompleteTrackData
    };
}
