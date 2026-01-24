/**
 * TTS Voice Configuration
 * 30 种 Gemini TTS 预设音色
 * 
 * 数据来源: https://ai.google.dev/gemini-api/docs/text-speech
 * 
 * 注意: Google 目前没有提供动态获取音色列表的 API
 * 如需更新，请手动核对官方文档
 */

export interface TTSVoice {
    name: string;           // 音色名称 (API 使用)
    description: string;    // 描述
    language: 'zh' | 'en' | 'ja' | 'multi';  // 推荐语言
    gender: 'female' | 'male' | 'neutral';
    style: string;          // 风格标签
}

// 完整的 30 种音色列表
export const TTS_VOICES: TTSVoice[] = [
    // 中文推荐
    { name: 'Aoede', description: '清澈温柔', language: 'zh', gender: 'female', style: 'Breezy' },
    { name: 'Kore', description: '坚定专业', language: 'zh', gender: 'female', style: 'Firm' },
    { name: 'Gacrux', description: '成熟稳重', language: 'zh', gender: 'male', style: 'Mature' },
    { name: 'Charon', description: '专业播报', language: 'zh', gender: 'male', style: 'Informative' },
    { name: 'Puck', description: '活泼开朗', language: 'zh', gender: 'neutral', style: 'Upbeat' },

    // 英文推荐
    { name: 'Zephyr', description: 'Bright', language: 'en', gender: 'female', style: 'Bright' },
    { name: 'Fenrir', description: 'Excitable', language: 'en', gender: 'male', style: 'Excitable' },
    { name: 'Leda', description: 'Youthful', language: 'en', gender: 'female', style: 'Youthful' },
    { name: 'Orus', description: 'Firm', language: 'en', gender: 'male', style: 'Firm' },
    { name: 'Callirrhoe', description: 'Confident', language: 'en', gender: 'female', style: 'Confident' },

    // 日文推荐
    { name: 'Despina', description: '温もり', language: 'ja', gender: 'female', style: 'Warm' },
    { name: 'Autonoe', description: '深みのある', language: 'ja', gender: 'female', style: 'Bright Mature' },
    { name: 'Umbriel', description: 'おっとり', language: 'ja', gender: 'male', style: 'Easy-going' },
    { name: 'Iapetus', description: '親しみやすい', language: 'ja', gender: 'male', style: 'Friendly' },

    // 其他音色 (多语言通用)
    { name: 'Enceladus', description: 'Breathy', language: 'multi', gender: 'female', style: 'Breathy' },
    { name: 'Algieba', description: 'Smooth', language: 'multi', gender: 'male', style: 'Smooth' },
    { name: 'Erinome', description: 'Clear', language: 'multi', gender: 'female', style: 'Clear' },
    { name: 'Algenib', description: 'Warm Confident', language: 'multi', gender: 'male', style: 'Warm Confident' },
    { name: 'Rasalgethi', description: 'Conversational', language: 'multi', gender: 'male', style: 'Conversational' },
    { name: 'Laomedeia', description: 'Upbeat', language: 'multi', gender: 'female', style: 'Upbeat' },
    { name: 'Achernar', description: 'Soft', language: 'multi', gender: 'female', style: 'Soft' },
    { name: 'Alnilam', description: 'Energetic', language: 'multi', gender: 'male', style: 'Energetic' },
    { name: 'Schedar', description: 'Even', language: 'multi', gender: 'female', style: 'Even' },
    { name: 'Pulcherrima', description: 'Bright Youthful', language: 'multi', gender: 'female', style: 'Bright Youthful' },
    { name: 'Achird', description: 'Friendly', language: 'multi', gender: 'male', style: 'Friendly' },
    { name: 'Zubenelgenubi', description: 'Casual', language: 'multi', gender: 'male', style: 'Casual' },
    { name: 'Vindemiatrix', description: 'Gentle', language: 'multi', gender: 'female', style: 'Gentle' },
    { name: 'Sadachbia', description: 'Deep Confident', language: 'multi', gender: 'male', style: 'Deep Confident' },
    { name: 'Sadaltager', description: 'Knowledgeable', language: 'multi', gender: 'male', style: 'Knowledgeable' },
    { name: 'Sulafat', description: 'Warm', language: 'multi', gender: 'male', style: 'Warm' },
];

// 按语言分组
export const VOICES_BY_LANGUAGE = {
    zh: TTS_VOICES.filter(v => v.language === 'zh'),
    en: TTS_VOICES.filter(v => v.language === 'en'),
    ja: TTS_VOICES.filter(v => v.language === 'ja'),
    multi: TTS_VOICES.filter(v => v.language === 'multi'),
};

// 按性别分组
export const VOICES_BY_GENDER = {
    female: TTS_VOICES.filter(v => v.gender === 'female'),
    male: TTS_VOICES.filter(v => v.gender === 'male'),
    neutral: TTS_VOICES.filter(v => v.gender === 'neutral'),
};

// 获取音色显示文本
export function getVoiceDisplayText(voice: TTSVoice): string {
    const genderIcon = voice.gender === 'female' ? '♀' : voice.gender === 'male' ? '♂' : '⚥';
    return `${voice.name} ${genderIcon} - ${voice.description}`;
}

// 根据名称查找音色
export function findVoiceByName(name: string): TTSVoice | undefined {
    return TTS_VOICES.find(v => v.name === name);
}
