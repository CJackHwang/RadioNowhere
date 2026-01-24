/**
 * Global State - 上下文记忆管理
 * 记录过去 10 分钟的 track_history 和 last_topic
 * 超过限制时使用 AI 压缩总结
 */

import { MoodType } from '@shared/types/radio-core';
import { STATE } from '@shared/utils/constants';

// ================== Types ==================

interface TrackHistoryEntry {
    search: string;
    playedAt: number;
}

interface TopicEntry {
    topic: string;
    speaker: string;
    timestamp: number;
}

interface SongWithLyrics {
    name: string;
    artist: string;
    lyrics?: string;  // 纯文本歌词
    playedAt: number;
}

interface ContextSummary {
    recentTracks: string[];       // 最近播放的歌曲
    recentTopics: string[];       // 最近讨论的话题
    overallMood: MoodType;        // 整体氛围
    compressedHistory?: string;   // AI 压缩的历史总结
    lastUpdated: number;
    recentSongsWithLyrics?: SongWithLyrics[];  // 带歌词的歌曲信息
}

// ================== Constants ==================

const CONTEXT_WINDOW_MS = 10 * 60 * 1000;  // 10 分钟
const MAX_TRACK_HISTORY = STATE.MAX_TRACK_HISTORY;
const MAX_TOPIC_HISTORY = STATE.MAX_TOPIC_HISTORY;
const COMPRESS_THRESHOLD = STATE.COMPRESS_THRESHOLD;

// ================== Global State Class ==================

class GlobalState {
    private trackHistory: TrackHistoryEntry[] = [];
    private topicHistory: TopicEntry[] = [];
    private compressedSummary: string | null = null;
    private currentMood: MoodType = 'calm';
    private songsWithLyrics: SongWithLyrics[] = [];  // 带歌词的歌曲缓存

    // ================== 记录 ==================

    /**
     * 记录播放的音乐
     */
    addTrack(search: string): void {
        this.trackHistory.push({
            search,
            playedAt: Date.now()
        });

        // 清理超时记录
        this.pruneOldEntries();

        // 检查是否需要压缩
        if (this.trackHistory.length > MAX_TRACK_HISTORY) {
            this.compressHistory();
        }
    }

    /**
     * 记录讨论的话题
     */
    addTopic(topic: string, speaker: string): void {
        this.topicHistory.push({
            topic,
            speaker,
            timestamp: Date.now()
        });

        // 清理超时记录
        this.pruneOldEntries();

        // 检查是否需要压缩
        if (this.topicHistory.length > MAX_TOPIC_HISTORY) {
            this.compressHistory();
        }
    }

    /**
     * 更新当前氛围
     */
    setMood(mood: MoodType): void {
        this.currentMood = mood;
    }

    /**
     * 添加带歌词的歌曲信息 (供 Writer Agent 生成更好的介绍)
     */
    addRecentlyPlayedSong(song: { name: string; artist: string; lyrics?: string }): void {
        this.songsWithLyrics.push({
            ...song,
            playedAt: Date.now()
        });

        // 限制缓存大小
        if (this.songsWithLyrics.length > 10) {
            this.songsWithLyrics = this.songsWithLyrics.slice(-10);
        }
    }

    /**
     * 获取最近带歌词的歌曲 (供 Prompt 使用)
     */
    getRecentSongsWithLyrics(limit: number = 3): { name: string; artist: string; lyrics?: string }[] {
        return this.songsWithLyrics.slice(-limit);
    }

    // ================== 查询 ==================

    /**
     * 获取最近播放的歌曲（用于去重）
     */
    getRecentTracks(limit: number = 5): string[] {
        return this.trackHistory
            .slice(-limit)
            .map(t => t.search);
    }

    /**
     * 获取最近的话题（用于避免重复）
     */
    getRecentTopics(limit: number = 5): string[] {
        return this.topicHistory
            .slice(-limit)
            .map(t => t.topic);
    }

    /**
     * 检查歌曲是否最近播放过
     */
    wasRecentlyPlayed(search: string): boolean {
        const recentTracks = this.getRecentTracks(10);
        return recentTracks.some(t =>
            t.toLowerCase().includes(search.toLowerCase()) ||
            search.toLowerCase().includes(t.toLowerCase())
        );
    }

    /**
     * 获取完整的上下文摘要（用于注入 Prompt）
     */
    getContextSummary(): ContextSummary {
        return {
            recentTracks: this.getRecentTracks(5),
            recentTopics: this.getRecentTopics(5),
            overallMood: this.currentMood,
            compressedHistory: this.compressedSummary || undefined,
            lastUpdated: Date.now()
        };
    }

    /**
     * 生成用于 Prompt 的上下文字符串
     */
    getContextForPrompt(): string {
        const summary = this.getContextSummary();

        let context = `## 当前上下文\n\n`;

        if (summary.compressedHistory) {
            context += `### 历史总结\n${summary.compressedHistory}\n\n`;
        }

        if (summary.recentTracks.length > 0) {
            context += `### 最近播放的歌曲（请勿重复）\n`;
            context += summary.recentTracks.map(t => `- ${t}`).join('\n');
            context += '\n\n';
        }

        if (summary.recentTopics.length > 0) {
            context += `### 最近讨论的话题（请换新话题）\n`;
            context += summary.recentTopics.map(t => `- ${t}`).join('\n');
            context += '\n\n';
        }

        // 添加歌词信息供 AI 参考
        const songsWithLyrics = this.getRecentSongsWithLyrics(2);
        if (songsWithLyrics.length > 0) {
            context += `### 最近歌曲歌词参考（可用于写介绍词）\n`;
            for (const song of songsWithLyrics) {
                context += `**${song.name}** - ${song.artist}\n`;
                if (song.lyrics) {
                    // 只取前几行歌词
                    const lyricsPreview = song.lyrics.split('\n').slice(0, 6).join('\n');
                    context += `\`\`\`\n${lyricsPreview}\n\`\`\`\n`;
                }
            }
            context += '\n';
        }

        context += `### 当前氛围\n${summary.overallMood}\n`;

        return context;
    }

    // ================== 内部方法 ==================

    /**
     * 清理超时记录
     */
    private pruneOldEntries(): void {
        const cutoff = Date.now() - CONTEXT_WINDOW_MS;

        this.trackHistory = this.trackHistory.filter(t => t.playedAt > cutoff);
        this.topicHistory = this.topicHistory.filter(t => t.timestamp > cutoff);
    }

    /**
     * 压缩历史记录
     */
    private async compressHistory(): Promise<void> {
        const totalEntries = this.trackHistory.length + this.topicHistory.length;
        if (totalEntries < COMPRESS_THRESHOLD) return;

        try {
            // 准备压缩内容
            const oldTracks = this.trackHistory.slice(0, -5);
            const oldTopics = this.topicHistory.slice(0, -5);

            if (oldTracks.length === 0 && oldTopics.length === 0) return;

            const contentToCompress = `
过去播放的歌曲: ${oldTracks.map(t => t.search).join(', ')}
过去讨论的话题: ${oldTopics.map(t => `${t.speaker}:${t.topic}`).join(', ')}
`;

            // 调用 AI 压缩
            const summary = await this.callAICompress(contentToCompress);

            if (summary) {
                // 保存压缩结果
                const existingSummary = this.compressedSummary || '';
                this.compressedSummary = existingSummary
                    ? `${existingSummary}\n${summary}`
                    : summary;

                // 清理已压缩的记录
                this.trackHistory = this.trackHistory.slice(-5);
                this.topicHistory = this.topicHistory.slice(-5);
            }
        } catch (error) {
            console.error('Failed to compress history:', error);
        }
    }

    /**
     * 调用 AI 压缩上下文
     */
    private async callAICompress(content: string): Promise<string | null> {
        // 动态导入避免循环依赖
        const { callGenerativeAI } = await import('@shared/services/ai-service');

        const prompt = `请用一两句话总结以下电台节目历史，保留重要的音乐和话题信息：

${content}

总结（简洁）：`;

        return callGenerativeAI({
            prompt,
            temperature: 0.3,
            maxOutputTokens: 100
        });
    }

    /**
     * 重置状态
     */
    reset(): void {
        this.trackHistory = [];
        this.topicHistory = [];
        this.compressedSummary = null;
        this.currentMood = 'calm';
    }
}

// 单例导出
export const globalState = new GlobalState();
