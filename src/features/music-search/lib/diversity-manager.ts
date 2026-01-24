// 禁止列表管理 - 追踪近24小时内已使用的歌手
const prohibitedArtists: Array<{ artist: string; timestamp: number }> = [];
const ARTIST_PROHIBITION_MS = 24 * 60 * 60 * 1000; // 24小时

/**
 * 获取禁止列表（近24小时内已使用的歌手）
 */
export function getProhibitedArtists(): string[] {
    const cutoff = Date.now() - ARTIST_PROHIBITION_MS;
    // 清理过期记录
    const validArtists = prohibitedArtists.filter(a => a.timestamp > cutoff);
    prohibitedArtists.length = 0;
    prohibitedArtists.push(...validArtists);
    return prohibitedArtists.map(a => a.artist);
}

/**
 * 记录已使用的歌手（添加到禁止列表）
 */
export function addProhibitedArtist(artist: string): void {
    if (!prohibitedArtists.some(a => a.artist === artist)) {
        prohibitedArtists.push({ artist, timestamp: Date.now() });
    }
}

/**
 * 批量记录多个歌手
 */
export function addProhibitedArtists(artists: string[]): void {
    artists.forEach(artist => addProhibitedArtist(artist));
}

/**
 * 检查歌手是否在禁止列表中
 */
export function isArtistProhibited(artist: string): boolean {
    const prohibited = getProhibitedArtists();
    return prohibited.some(p => 
        p.toLowerCase() === artist.toLowerCase()
    );
}

/**
 * 分析音乐多样性（用于检查工具）
 */
export function analyzeDiversity(artists: string[]): {
    score: number;
    feedback: string[];
    violations: string[];
} {
    const prohibited = getProhibitedArtists();
    
    // 检查禁止列表违反
    const violations = artists.filter(a => 
        prohibited.some(p => p.toLowerCase() === a.toLowerCase())
    );
    
    const feedback: string[] = [];
    let score = 0;
    
    // 检查唯一性
    const uniqueArtists = new Set(artists.map(a => a.toLowerCase()));
    const uniquenessRatio = uniqueArtists.size / artists.length;
    if (uniquenessRatio === 1) {
        score += 40;
        feedback.push('✓ 歌手唯一性完美（每个歌手仅一次）');
    } else {
        score += Math.floor(uniquenessRatio * 40);
        feedback.push(`✗ 歌手重复：${(1 - uniquenessRatio) * 100 | 0}% 重复率`);
    }
    
    // 检查语言多样性
    const hasChineseSingers = artists.some(a => /[\u4E00-\u9FA5]/.test(a));
    const hasEnglishSingers = artists.some(a => /[a-zA-Z\s]/.test(a));
    if (hasChineseSingers && hasEnglishSingers) {
        score += 30;
        feedback.push('✓ 语言多样性：中英混搭');
    } else {
        feedback.push('✗ 语言单一');
    }
    
    // 检查歌手数量
    if (uniqueArtists.size >= 3) {
        score += 20;
        feedback.push(`✓ 歌手数量充足：${uniqueArtists.size}个不同歌手`);
    } else {
        feedback.push(`✗ 歌手数量过少：仅${uniqueArtists.size}个`);
    }
    
    // 检查禁止列表
    if (violations.length === 0) {
        score += 10;
        feedback.push('✓ 禁止列表：完全遵守');
    } else {
        feedback.push(`❌ 禁止列表违反：${violations.join(', ')}`);
        score = 0; // 违反禁止列表则整体失败
    }
    
    return { score, feedback, violations };
}

/**
 * 清空禁止列表（仅用于测试或管理员操作）
 */
export function clearProhibitedArtists(): void {
    prohibitedArtists.length = 0;
}