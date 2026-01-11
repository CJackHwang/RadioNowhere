/**
 * Writer Tools - 编剧 Agent 的工具系统
 * 提供音乐搜索、歌词获取、节目提交等工具
 */

import { searchMusic, getLyrics, IGDMusicTrack, searchMusicWithValidation } from '../gdmusic_service';
import { ShowTimeline } from '../types/radio_types';
import { recordShow, recordSong, getRecentConcepts, getRecentSongs, isDuplicateConcept } from '../show_history';

// ================== Tool Definitions ==================

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        name: string;
        type: string;
        description: string;
        required: boolean;
    }[];
}

export const WRITER_TOOLS: ToolDefinition[] = [
    {
        name: 'search_music',
        description: '搜索歌曲。⚠️ 重要：此API只支持搜索【具体歌手名】或【具体歌名】，不支持搜索风格/流派！请根据你的知识库，搜索符合节目氛围的具体歌手（如"陈绮贞"、"房东的猫"、"Ed Sheeran"）或歌曲名。如果搜索结果不理想，请尝试其他歌手/歌曲。',
        parameters: [
            { name: 'query', type: 'string', description: '搜索关键词（必须是具体歌手名或歌曲名，如"周杰伦"、"Shape of You"）', required: true },
            { name: 'mood', type: 'string', description: '期望的情绪氛围（仅供参考，不影响搜索）', required: false }
        ]
    },
    {
        name: 'get_lyrics',
        description: '获取歌曲歌词。需要先用 search_music 获取 lyricId。',
        parameters: [
            { name: 'song_title', type: 'string', description: '歌曲名称', required: true },
            { name: 'lyric_id', type: 'string', description: '歌词ID (从 search_music 结果获取)', required: false }
        ]
    },
    {
        name: 'check_duplicate',
        description: '检查节目概念是否与近1小时内的节目雷同。返回 true/false。',
        parameters: [
            { name: 'concept', type: 'string', description: '节目概念描述', required: true }
        ]
    },
    {
        name: 'submit_show',
        description: '提交最终节目。如果格式正确返回成功，否则返回错误信息供修正。这是唯一能结束循环的方式。',
        parameters: [
            { name: 'timeline_json', type: 'string', description: '完整的 ShowTimeline JSON', required: true }
        ]
    }
];

// ================== Tool Results ==================

export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

// ================== Tool Execution ==================

/**
 * 执行工具调用
 */
export async function executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
    parseTimeline: (json: string) => ShowTimeline
): Promise<ToolResult> {
    try {
        switch (toolName) {
            case 'search_music':
                return await executeSearchMusic(args.query as string, args.mood as string | undefined);

            case 'get_lyrics':
                return await executeGetLyrics(args.song_title as string, args.lyric_id as string | undefined);

            case 'check_duplicate':
                return executeCheckDuplicate(args.concept as string);

            case 'submit_show':
                return executeSubmitShow(args.timeline_json as string, parseTimeline);

            default:
                return { success: false, error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

// ================== Tool Implementations ==================

async function executeSearchMusic(query: string, mood?: string): Promise<ToolResult> {
    try {
        // 使用带验证的搜索，确保只返回可播放的歌曲
        const validatedTracks = await searchMusicWithValidation(query, 5);

        // 过滤掉已播放的歌曲
        const recentSongs = getRecentSongs();
        const filteredTracks = validatedTracks.filter(({ track }) =>
            !recentSongs.some(s =>
                s.toLowerCase().includes(track.name.toLowerCase()) ||
                track.name.toLowerCase().includes(s.toLowerCase())
            )
        );

        const results = filteredTracks.map(({ track, url }) => ({
            title: track.name,
            artist: track.artist.join(', '),
            album: track.album,
            id: track.id,
            lyricId: track.lyricId,
            url: url, // 返回已验证的 URL
            source: track.source
        }));

        if (results.length === 0) {
            return {
                success: false,
                error: `未找到可播放的歌曲："${query}"。请尝试其他歌手名或歌曲名。`
            };
        }

        return {
            success: true,
            data: {
                query,
                results,
                note: `找到 ${results.length} 首可播放的歌曲（已验证链接有效）`
            }
        };
    } catch (error) {
        return { success: false, error: `搜索失败: ${String(error)}` };
    }
}

async function executeGetLyrics(songTitle: string, lyricId?: string): Promise<ToolResult> {
    try {
        // 如果提供了 lyricId，直接获取歌词
        if (lyricId) {
            const lyricsData = await getLyrics(lyricId);
            if (lyricsData) {
                return {
                    success: true,
                    data: {
                        song: songTitle,
                        lyrics: lyricsData.lyric,
                        translation: lyricsData.tlyric || null
                    }
                };
            }
        }

        // 否则返回空
        return {
            success: true,
            data: {
                song: songTitle,
                lyrics: null,
                note: lyricId ? '歌词获取失败' : '需要先搜索歌曲获取 lyricId'
            }
        };
    } catch (error) {
        return { success: false, error: `歌词获取失败: ${String(error)}` };
    }
}

function executeCheckDuplicate(concept: string): ToolResult {
    const isDuplicate = isDuplicateConcept(concept);
    const recentConcepts = getRecentConcepts();

    return {
        success: true,
        data: {
            isDuplicate,
            recentConcepts: recentConcepts.slice(0, 5),
            suggestion: isDuplicate
                ? '该概念与近期节目雷同，请换一个不同的方向'
                : '概念独特，可以继续'
        }
    };
}

function executeSubmitShow(
    timelineJson: string,
    parseTimeline: (json: string) => ShowTimeline
): ToolResult {
    try {
        // 尝试解析
        const timeline = parseTimeline(timelineJson);

        // 验证基本结构
        if (!timeline.id || !timeline.blocks || timeline.blocks.length === 0) {
            return {
                success: false,
                error: 'Timeline 缺少必要字段: id, blocks 必须存在且 blocks 不能为空'
            };
        }

        // 记录到历史
        recordShow(timeline.title || 'Untitled', 'default', []);

        // 记录使用的歌曲
        for (const block of timeline.blocks) {
            if (block.type === 'music' && block.search) {
                recordSong(block.search);
            }
        }

        return {
            success: true,
            data: {
                id: timeline.id,
                title: timeline.title,
                blockCount: timeline.blocks.length,
                message: '节目提交成功！'
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `JSON 解析失败: ${String(error)}。请检查 JSON 格式是否正确，确保所有引号、逗号、括号都正确匹配。`
        };
    }
}

// ================== Context Helpers ==================

/**
 * 获取历史上下文（用于 System Prompt）
 */
export function getHistoryContext(): string {
    const recentConcepts = getRecentConcepts();
    const recentSongs = getRecentSongs();

    let context = '';

    if (recentConcepts.length > 0) {
        context += `\n## 近期节目（请避免雷同）\n${recentConcepts.slice(0, 5).map(c => `- ${c}`).join('\n')}\n`;
    }

    if (recentSongs.length > 0) {
        context += `\n## 近期播放歌曲（请勿重复）\n${recentSongs.slice(0, 10).map(s => `- ${s}`).join('\n')}\n`;
    }

    return context;
}

/**
 * 生成工具描述（用于 System Prompt）
 */
export function getToolsDescription(): string {
    return WRITER_TOOLS.map(tool => {
        const params = tool.parameters.map(p =>
            `  - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`
        ).join('\n');
        return `### ${tool.name}\n${tool.description}\nParameters:\n${params}`;
    }).join('\n\n');
}
