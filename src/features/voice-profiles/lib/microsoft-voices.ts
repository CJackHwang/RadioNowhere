/**
 * Microsoft TTS Voice Configuration
 * 精选的中文、日语、英语 Neural 音色
 * 
 * 默认 API 接口: https://tts.cjack.top/api/text-to-speech
 */

export interface MicrosoftTTSVoice {
    name: string;           // 简短名称 e.g., "XiaoxiaoNeural"
    fullName: string;       // 完整音色名称 (API 使用)
    locale: string;         // 区域代码 e.g., "zh-CN"
    language: 'zh' | 'ja' | 'en';
    gender: 'Female' | 'Male';
    displayName: string;    // 显示名称
    style?: string;         // 可选的风格标签
}

// ================== 中文音色 ==================
const CHINESE_VOICES: MicrosoftTTSVoice[] = [
    // 中国大陆 (zh-CN)
    {
        name: 'XiaoxiaoNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓晓 · 温柔甜美',
        style: 'Assistant'
    },
    {
        name: 'YunxiNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, YunxiNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Male',
        displayName: '云希 · 阳光少年',
        style: 'Narration'
    },
    {
        name: 'XiaoyiNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoyiNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓伊 · 活泼可爱',
        style: 'Chat'
    },
    {
        name: 'YunjianNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, YunjianNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Male',
        displayName: '云健 · 成熟稳重',
        style: 'Sports'
    },
    {
        name: 'XiaochenNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaochenNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓辰 · 知性优雅',
        style: 'Documentary'
    },
    {
        name: 'XiaohanNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaohanNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓涵 · 温柔细腻',
        style: 'Calm'
    },
    {
        name: 'XiaomengNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaomengNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓梦 · 甜美梦幻',
        style: 'Chat'
    },
    {
        name: 'XiaomoNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaomoNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓墨 · 端庄大气',
        style: 'Serious'
    },
    {
        name: 'XiaoruiNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoruiNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓睿 · 沉稳理性',
        style: 'Calm'
    },
    {
        name: 'XiaoshuangNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoshuangNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓双 · 童声可爱',
        style: 'Child'
    },
    {
        name: 'XiaoxuanNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxuanNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓璇 · 甜美清新',
        style: 'Calm'
    },
    {
        name: 'XiaoyanNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoyanNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓颜 · 客服专业',
        style: 'CustomerService'
    },
    {
        name: 'XiaoyouNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoyouNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓悠 · 童声天真',
        style: 'Child'
    },
    {
        name: 'XiaozhenNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaozhenNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Female',
        displayName: '晓甄 · 新闻播报',
        style: 'News'
    },
    {
        name: 'YunfengNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, YunfengNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Male',
        displayName: '云枫 · 低沉磁性',
        style: 'Narration'
    },
    {
        name: 'YunhaoNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, YunhaoNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Male',
        displayName: '云皓 · 广告配音',
        style: 'Advertisement'
    },
    {
        name: 'YunxiaNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, YunxiaNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Male',
        displayName: '云夏 · 童声活泼',
        style: 'Child'
    },
    {
        name: 'YunyangNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, YunyangNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Male',
        displayName: '云扬 · 新闻专业',
        style: 'News'
    },
    {
        name: 'YunyeNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, YunyeNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Male',
        displayName: '云野 · 故事旁白',
        style: 'Narration'
    },
    {
        name: 'YunzeNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-CN, YunzeNeural)',
        locale: 'zh-CN',
        language: 'zh',
        gender: 'Male',
        displayName: '云泽 · 纪录片',
        style: 'Documentary'
    },
    // 台湾 (zh-TW)
    {
        name: 'HsiaoChenNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-TW, HsiaoChenNeural)',
        locale: 'zh-TW',
        language: 'zh',
        gender: 'Female',
        displayName: '曉臻 · 台灣女聲',
        style: 'Chat'
    },
    {
        name: 'HsiaoYuNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-TW, HsiaoYuNeural)',
        locale: 'zh-TW',
        language: 'zh',
        gender: 'Female',
        displayName: '曉雨 · 台灣甜美',
        style: 'Chat'
    },
    {
        name: 'YunJheNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-TW, YunJheNeural)',
        locale: 'zh-TW',
        language: 'zh',
        gender: 'Male',
        displayName: '雲哲 · 台灣男聲',
        style: 'Narration'
    },
    // 香港 (zh-HK)
    {
        name: 'HiuGaaiNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-HK, HiuGaaiNeural)',
        locale: 'zh-HK',
        language: 'zh',
        gender: 'Female',
        displayName: '曉佳 · 香港女聲',
        style: 'Chat'
    },
    {
        name: 'HiuMaanNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-HK, HiuMaanNeural)',
        locale: 'zh-HK',
        language: 'zh',
        gender: 'Female',
        displayName: '曉曼 · 香港優雅',
        style: 'Chat'
    },
    {
        name: 'WanLungNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (zh-HK, WanLungNeural)',
        locale: 'zh-HK',
        language: 'zh',
        gender: 'Male',
        displayName: '雲龍 · 香港男聲',
        style: 'Narration'
    },
];

// ================== 日语音色 ==================
const JAPANESE_VOICES: MicrosoftTTSVoice[] = [
    {
        name: 'NanamiNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (ja-JP, NanamiNeural)',
        locale: 'ja-JP',
        language: 'ja',
        gender: 'Female',
        displayName: '七海 · 温柔女声',
        style: 'Chat'
    },
    {
        name: 'KeitaNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (ja-JP, KeitaNeural)',
        locale: 'ja-JP',
        language: 'ja',
        gender: 'Male',
        displayName: '圭太 · 阳光男声',
        style: 'Chat'
    },
    {
        name: 'AoiNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (ja-JP, AoiNeural)',
        locale: 'ja-JP',
        language: 'ja',
        gender: 'Female',
        displayName: '葵 · 可爱女声',
        style: 'Cheerful'
    },
    {
        name: 'DaichiNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (ja-JP, DaichiNeural)',
        locale: 'ja-JP',
        language: 'ja',
        gender: 'Male',
        displayName: '大地 · 成熟男声',
        style: 'Narration'
    },
    {
        name: 'MayuNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (ja-JP, MayuNeural)',
        locale: 'ja-JP',
        language: 'ja',
        gender: 'Female',
        displayName: '真悠 · 知性女声',
        style: 'CustomerService'
    },
    {
        name: 'NaokiNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (ja-JP, NaokiNeural)',
        locale: 'ja-JP',
        language: 'ja',
        gender: 'Male',
        displayName: '直樹 · 专业男声',
        style: 'CustomerService'
    },
    {
        name: 'ShioriNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (ja-JP, ShioriNeural)',
        locale: 'ja-JP',
        language: 'ja',
        gender: 'Female',
        displayName: '栞 · 甜美女声',
        style: 'Friendly'
    },
];

// ================== 英语音色 ==================
const ENGLISH_VOICES: MicrosoftTTSVoice[] = [
    // 美式英语 (en-US)
    {
        name: 'JennyNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Jenny · Conversational',
        style: 'Chat'
    },
    {
        name: 'GuyNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, GuyNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Guy · News Anchor',
        style: 'News'
    },
    {
        name: 'AriaNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, AriaNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Aria · Expressive',
        style: 'Chat'
    },
    {
        name: 'DavisNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, DavisNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Davis · Calm',
        style: 'Calm'
    },
    {
        name: 'AmberNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, AmberNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Amber · Warm',
        style: 'Warm'
    },
    {
        name: 'AnaNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, AnaNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Ana · Child',
        style: 'Child'
    },
    {
        name: 'AndrewNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, AndrewNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Andrew · Warm',
        style: 'Warm'
    },
    {
        name: 'BrianNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, BrianNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Brian · Narration',
        style: 'Narration'
    },
    {
        name: 'ChristopherNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, ChristopherNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Christopher · Reliable',
        style: 'News'
    },
    {
        name: 'CoraNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, CoraNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Cora · Formal',
        style: 'Formal'
    },
    {
        name: 'ElizabethNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, ElizabethNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Elizabeth · Authoritative',
        style: 'Authoritative'
    },
    {
        name: 'EricNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, EricNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Eric · Friendly',
        style: 'Friendly'
    },
    {
        name: 'JacobNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, JacobNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Jacob · Casual',
        style: 'Casual'
    },
    {
        name: 'JaneNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, JaneNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Jane · Angry to Cheerful',
        style: 'Expressive'
    },
    {
        name: 'JasonNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, JasonNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Jason · Sports',
        style: 'Sports'
    },
    {
        name: 'MichelleNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, MichelleNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Michelle · Friendly',
        style: 'Friendly'
    },
    {
        name: 'MonicaNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, MonicaNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Monica · Professional',
        style: 'Professional'
    },
    {
        name: 'NancyNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, NancyNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Nancy · Expressive',
        style: 'Expressive'
    },
    {
        name: 'RogerNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, RogerNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Roger · Elderly',
        style: 'Calm'
    },
    {
        name: 'SaraNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, SaraNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        displayName: 'Sara · Cheerful',
        style: 'Cheerful'
    },
    {
        name: 'SteffanNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, SteffanNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Steffan · Conversational',
        style: 'Chat'
    },
    {
        name: 'TonyNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-US, TonyNeural)',
        locale: 'en-US',
        language: 'en',
        gender: 'Male',
        displayName: 'Tony · Angry to Cheerful',
        style: 'Expressive'
    },
    // 英式英语 (en-GB)
    {
        name: 'SoniaNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-GB, SoniaNeural)',
        locale: 'en-GB',
        language: 'en',
        gender: 'Female',
        displayName: 'Sonia · British Female',
        style: 'Chat'
    },
    {
        name: 'RyanNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-GB, RyanNeural)',
        locale: 'en-GB',
        language: 'en',
        gender: 'Male',
        displayName: 'Ryan · British Male',
        style: 'Chat'
    },
    {
        name: 'LibbyNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-GB, LibbyNeural)',
        locale: 'en-GB',
        language: 'en',
        gender: 'Female',
        displayName: 'Libby · British Warm',
        style: 'Warm'
    },
    {
        name: 'MaisieNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-GB, MaisieNeural)',
        locale: 'en-GB',
        language: 'en',
        gender: 'Female',
        displayName: 'Maisie · British Child',
        style: 'Child'
    },
    {
        name: 'ThomasNeural',
        fullName: 'Microsoft Server Speech Text to Speech Voice (en-GB, ThomasNeural)',
        locale: 'en-GB',
        language: 'en',
        gender: 'Male',
        displayName: 'Thomas · British Formal',
        style: 'Formal'
    },
];

// ================== 导出合并列表 ==================

export const MICROSOFT_TTS_VOICES: MicrosoftTTSVoice[] = [
    ...CHINESE_VOICES,
    ...JAPANESE_VOICES,
    ...ENGLISH_VOICES,
];

// 按语言分组
export const MICROSOFT_VOICES_BY_LANGUAGE = {
    zh: CHINESE_VOICES,
    ja: JAPANESE_VOICES,
    en: ENGLISH_VOICES,
    all: MICROSOFT_TTS_VOICES,
};

// 按性别分组
export const MICROSOFT_VOICES_BY_GENDER = {
    Female: MICROSOFT_TTS_VOICES.filter(v => v.gender === 'Female'),
    Male: MICROSOFT_TTS_VOICES.filter(v => v.gender === 'Male'),
};

// 获取显示文本
export function getMicrosoftVoiceDisplayText(voice: MicrosoftTTSVoice): string {
    const genderIcon = voice.gender === 'Female' ? '♀' : '♂';
    return `${voice.displayName} ${genderIcon}`;
}

// 根据 fullName 查找音色
export function findMicrosoftVoiceByFullName(fullName: string): MicrosoftTTSVoice | undefined {
    return MICROSOFT_TTS_VOICES.find(v => v.fullName === fullName);
}

// 根据简短名称查找音色
export function findMicrosoftVoiceByName(name: string): MicrosoftTTSVoice | undefined {
    return MICROSOFT_TTS_VOICES.find(v => v.name === name);
}

// 默认音色
export const DEFAULT_MICROSOFT_VOICE = CHINESE_VOICES[0]; // XiaoxiaoNeural
