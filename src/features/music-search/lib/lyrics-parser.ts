/**
 * LRC Lyrics Parser
 * Parses LRC format lyrics and provides sync utilities
 */

export interface LyricLine {
    time: number;       // Time in milliseconds
    text: string;       // Lyric text
}

export interface ParsedLyrics {
    lines: LyricLine[];
    metadata?: {
        title?: string;
        artist?: string;
        album?: string;
        offset?: number;
    };
}

/**
 * Parse LRC format string into structured lyrics
 * 
 * LRC Format example:
 * [ti:Song Title]
 * [ar:Artist Name]
 * [00:12.00]First line of lyrics
 * [00:17.20]Second line of lyrics
 * 
 * @param lrcString - Raw LRC string
 * @returns ParsedLyrics object
 */
export function parseLRC(lrcString: string): ParsedLyrics {
    if (!lrcString) {
        return { lines: [] };
    }

    const lines: LyricLine[] = [];
    const metadata: ParsedLyrics['metadata'] = {};

    // LRC timestamp regex: [mm:ss.xx] or [mm:ss:xx] or [mm:ss]
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    // Metadata regex: [tag:value]
    const metaRegex = /\[(ti|ar|al|offset):([^\]]+)\]/gi;

    const rawLines = lrcString.split('\n');

    for (const line of rawLines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Check for metadata
        const metaMatch = metaRegex.exec(trimmedLine);
        if (metaMatch) {
            const [, tag, value] = metaMatch;
            switch (tag.toLowerCase()) {
                case 'ti': metadata.title = value.trim(); break;
                case 'ar': metadata.artist = value.trim(); break;
                case 'al': metadata.album = value.trim(); break;
                case 'offset': metadata.offset = parseInt(value.trim(), 10); break;
            }
            metaRegex.lastIndex = 0;
            continue;
        }

        // Extract all timestamps from the line
        const timestamps: number[] = [];
        let match;
        let lastIndex = 0;

        while ((match = timeRegex.exec(trimmedLine)) !== null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const centiseconds = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;

            const timeMs = (minutes * 60 + seconds) * 1000 + centiseconds;
            timestamps.push(timeMs);
            lastIndex = match.index + match[0].length;
        }
        timeRegex.lastIndex = 0;

        // Get the text after all timestamps
        const text = trimmedLine.slice(lastIndex).trim();

        // Add a line entry for each timestamp (handles multiple timestamps per line)
        for (const time of timestamps) {
            if (text) {
                lines.push({ time, text });
            }
        }
    }

    // Sort by time
    lines.sort((a, b) => a.time - b.time);

    return {
        lines,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    };
}

/**
 * Get the index of the current lyric line based on playback time
 * 
 * @param lyrics - Array of parsed lyric lines
 * @param currentTimeMs - Current playback time in milliseconds
 * @returns Index of current line, or -1 if before first line
 */
export function getCurrentLineIndex(lyrics: LyricLine[], currentTimeMs: number): number {
    if (!lyrics.length) return -1;

    // Find the last line with time <= currentTime
    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= currentTimeMs) {
            index = i;
        } else {
            break;
        }
    }

    return index;
}

/**
 * Get lyrics for display with context (surrounding lines)
 * 
 * @param lyrics - Parsed lyrics
 * @param currentTimeMs - Current time in ms
 * @param contextLines - Number of lines before and after to include
 */
export function getLyricsWindow(
    lyrics: LyricLine[],
    currentTimeMs: number,
    contextLines: number = 3
): { lines: LyricLine[]; currentIndex: number } {
    const currentIndex = getCurrentLineIndex(lyrics, currentTimeMs);

    if (currentIndex === -1) {
        // Before first lyric, show first few lines
        return {
            lines: lyrics.slice(0, contextLines * 2 + 1),
            currentIndex: -1
        };
    }

    const startIndex = Math.max(0, currentIndex - contextLines);
    const endIndex = Math.min(lyrics.length, currentIndex + contextLines + 1);

    return {
        lines: lyrics.slice(startIndex, endIndex),
        currentIndex: currentIndex - startIndex
    };
}

/**
 * Format time in mm:ss format for display
 */
export function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
