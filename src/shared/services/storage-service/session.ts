/**
 * Session Store - 会话持久化管理
 * 保存节目进度、时间线、上下文历史
 */

import { ShowTimeline } from '@shared/types/radio-core';

const SESSION_KEY = 'radio_nowhere_session';
const PLAYLIST_KEY = 'radio_nowhere_playlists';

// ================== Interfaces ==================

export interface RadioSession {
    id: string;
    timeline: ShowTimeline;
    currentBlockIndex: number;
    playbackPosition: number;  // 当前块播放进度（秒）
    savedAt: number;           // 保存时间戳
    globalContext?: string;    // 压缩后的节目上下文
}

export interface SavedPlaylist {
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    updatedAt: number;
    timelines: ShowTimeline[];
    totalDuration: number;     // 总时长（秒）
}

// ================== Session Functions ==================

/**
 * 保存当前会话
 */
export function saveSession(session: Omit<RadioSession, 'savedAt'>): void {
    if (typeof window === 'undefined') return;

    const fullSession: RadioSession = {
        ...session,
        savedAt: Date.now()
    };

    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(fullSession));
        console.log('[Session] Saved session:', session.id, 'block:', session.currentBlockIndex);
    } catch (error) {
        console.error('[Session] Failed to save:', error);
    }
}

/**
 * 获取已保存的会话
 */
export function getSession(): RadioSession | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (!stored) return null;

        const session: RadioSession = JSON.parse(stored);

        // 检查会话是否过期（24小时）
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - session.savedAt > maxAge) {
            clearSession();
            return null;
        }

        return session;
    } catch (error) {
        console.error('[Session] Failed to load:', error);
        return null;
    }
}

/**
 * 清除会话
 */
export function clearSession(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_KEY);
    console.log('[Session] Cleared');
}

/**
 * 检查是否有可恢复的会话
 */
export function hasSession(): boolean {
    return getSession() !== null;
}

// ================== Playlist Functions ==================

/**
 * 获取所有保存的节目单
 */
export function getPlaylists(): SavedPlaylist[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(PLAYLIST_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch (error) {
        console.error('[Playlist] Failed to load:', error);
        return [];
    }
}

/**
 * 保存节目单
 */
export function savePlaylist(playlist: Omit<SavedPlaylist, 'id' | 'createdAt' | 'updatedAt'>): SavedPlaylist {
    if (typeof window === 'undefined') throw new Error('Cannot save playlist on server');

    const playlists = getPlaylists();

    const newPlaylist: SavedPlaylist = {
        ...playlist,
        id: `playlist-${Date.now()}`,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    playlists.push(newPlaylist);

    try {
        localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlists));
        console.log('[Playlist] Saved:', newPlaylist.name);
        return newPlaylist;
    } catch (error) {
        console.error('[Playlist] Failed to save:', error);
        throw error;
    }
}

/**
 * 更新节目单
 */
export function updatePlaylist(id: string, updates: Partial<SavedPlaylist>): SavedPlaylist | null {
    if (typeof window === 'undefined') return null;

    const playlists = getPlaylists();
    const index = playlists.findIndex(p => p.id === id);

    if (index === -1) return null;

    playlists[index] = {
        ...playlists[index],
        ...updates,
        updatedAt: Date.now()
    };

    try {
        localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlists));
        return playlists[index];
    } catch (error) {
        console.error('[Playlist] Failed to update:', error);
        return null;
    }
}

/**
 * 删除节目单
 */
export function deletePlaylist(id: string): boolean {
    if (typeof window === 'undefined') return false;

    const playlists = getPlaylists();
    const filtered = playlists.filter(p => p.id !== id);

    if (filtered.length === playlists.length) return false;

    try {
        localStorage.setItem(PLAYLIST_KEY, JSON.stringify(filtered));
        console.log('[Playlist] Deleted:', id);
        return true;
    } catch (error) {
        console.error('[Playlist] Failed to delete:', error);
        return false;
    }
}

/**
 * 获取单个节目单
 */
export function getPlaylistById(id: string): SavedPlaylist | null {
    const playlists = getPlaylists();
    return playlists.find(p => p.id === id) || null;
}

/**
 * 从当前时间线创建节目单
 */
export function createPlaylistFromTimeline(
    name: string,
    timeline: ShowTimeline,
    description?: string
): SavedPlaylist {
    return savePlaylist({
        name,
        description,
        timelines: [timeline],
        totalDuration: timeline.estimatedDuration || 0
    });
}

/**
 * 添加时间线到现有节目单
 */
export function addTimelineToPlaylist(playlistId: string, timeline: ShowTimeline): boolean {
    const playlist = getPlaylistById(playlistId);
    if (!playlist) return false;

    const updatedTimelines = [...playlist.timelines, timeline];
    const totalDuration = updatedTimelines.reduce(
        (sum, t) => sum + (t.estimatedDuration || 0),
        0
    );

    return updatePlaylist(playlistId, {
        timelines: updatedTimelines,
        totalDuration
    }) !== null;
}
