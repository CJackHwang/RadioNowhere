/**
 * Settings Store - LocalStorage-based persistent API configuration
 */

const STORAGE_KEY = "radio_nowhere_settings";

export type ApiType = "openai" | "gemini" | "vertexai";
export type TTSProvider = "gemini" | "microsoft";

export interface IApiSettings {
    endpoint: string;      // API base URL (e.g., https://api.openai.com)
    apiKey: string;        // API Key
    modelName: string;     // Model name (e.g., gpt-4o, gemini-2.5-flash)
    apiType: ApiType;      // API format type: openai or gemini

    // Vertex AI 特定配置
    gcpProject: string;    // GCP Project ID
    gcpLocation: string;   // GCP Region (e.g., us-central1)

    // TTS 独立配置
    ttsProvider: TTSProvider;  // TTS 渠道: gemini 或 microsoft
    ttsEndpoint: string;   // TTS API Endpoint (留空则使用官方)
    ttsApiKey: string;     // TTS API Key (可以和主 key 不同)
    ttsModel: string;      // TTS Model name
    ttsVoice: string;      // 默认语音 (Gemini)
    ttsUseVertex: boolean; // 是否在 TTS 时使用 Vertex AI 配置

    // Microsoft TTS 配置
    msTtsEndpoint: string;     // Microsoft TTS API 地址 (默认: https://tts.cjack.top)
    msTtsVoice: string;        // Microsoft 音色全名
    msTtsVolume: number;       // 音量 (0-100)
    msTtsRate: number;         // 语速 (-10 to 10)
    msTtsPitch: number;        // 音调 (-10 to 10)
    msTtsAuthKey: string;      // 可选的 Bearer token

    // 播放配置
    preloadBlockCount: number;  // 提前准备的 block 数量 (推荐: 5)
}

const DEFAULT_SETTINGS: IApiSettings = {
    endpoint: "",
    apiKey: "",
    modelName: "gpt-4o",
    apiType: "openai",
    gcpProject: "",
    gcpLocation: "us-central1",
    // Gemini TTS
    ttsProvider: "gemini",
    ttsEndpoint: "",
    ttsApiKey: "",
    ttsModel: "gemini-2.5-flash-preview-tts",
    ttsVoice: "Aoede",
    ttsUseVertex: false,
    // Microsoft TTS
    msTtsEndpoint: "https://tts.cjack.top",
    msTtsVoice: "Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)",
    msTtsVolume: 100,
    msTtsRate: 0,
    msTtsPitch: 0,
    msTtsAuthKey: "",
    // 播放配置
    preloadBlockCount: 3,
};

// 可用的 TTS 语音列表
export const TTS_VOICES = [
    { name: 'Aoede', desc: '女声 · 清澈温柔' },
    { name: 'Kore', desc: '女声 · 坚定专业' },
    { name: 'Leda', desc: '女声 · 年轻活泼' },
    { name: 'Despina', desc: '女声 · 温暖亲切' },
    { name: 'Gacrux', desc: '男声 · 成熟稳重' },
    { name: 'Charon', desc: '男声 · 专业播报' },
    { name: 'Puck', desc: '中性 · 活泼开朗' },
    { name: 'Sadachbia', desc: '男声 · 低沉有磁性' },
];

/**
 * Get API settings from LocalStorage
 */
export function getSettings(): IApiSettings {
    if (typeof window === "undefined") {
        return DEFAULT_SETTINGS;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return DEFAULT_SETTINGS;
        }

        const parsed = JSON.parse(stored) as Partial<IApiSettings>;
        return {
            endpoint: parsed.endpoint ?? DEFAULT_SETTINGS.endpoint,
            apiKey: parsed.apiKey ?? DEFAULT_SETTINGS.apiKey,
            modelName: parsed.modelName ?? DEFAULT_SETTINGS.modelName,
            apiType: parsed.apiType ?? DEFAULT_SETTINGS.apiType,
            gcpProject: parsed.gcpProject ?? DEFAULT_SETTINGS.gcpProject,
            gcpLocation: parsed.gcpLocation ?? DEFAULT_SETTINGS.gcpLocation,
            // Gemini TTS
            ttsProvider: parsed.ttsProvider ?? DEFAULT_SETTINGS.ttsProvider,
            ttsEndpoint: parsed.ttsEndpoint ?? DEFAULT_SETTINGS.ttsEndpoint,
            ttsApiKey: parsed.ttsApiKey ?? DEFAULT_SETTINGS.ttsApiKey,
            ttsModel: parsed.ttsModel ?? DEFAULT_SETTINGS.ttsModel,
            ttsVoice: parsed.ttsVoice ?? DEFAULT_SETTINGS.ttsVoice,
            ttsUseVertex: parsed.ttsUseVertex ?? DEFAULT_SETTINGS.ttsUseVertex,
            // Microsoft TTS
            msTtsEndpoint: parsed.msTtsEndpoint ?? DEFAULT_SETTINGS.msTtsEndpoint,
            msTtsVoice: parsed.msTtsVoice ?? DEFAULT_SETTINGS.msTtsVoice,
            msTtsVolume: parsed.msTtsVolume ?? DEFAULT_SETTINGS.msTtsVolume,
            msTtsRate: parsed.msTtsRate ?? DEFAULT_SETTINGS.msTtsRate,
            msTtsPitch: parsed.msTtsPitch ?? DEFAULT_SETTINGS.msTtsPitch,
            msTtsAuthKey: parsed.msTtsAuthKey ?? DEFAULT_SETTINGS.msTtsAuthKey,
            // 播放配置
            preloadBlockCount: parsed.preloadBlockCount ?? DEFAULT_SETTINGS.preloadBlockCount,
        };
    } catch (e) {
        console.error("Failed to parse settings:", e);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Save API settings to LocalStorage
 */
export function saveSettings(settings: IApiSettings): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save settings:", e);
    }
}

/**
 * Clear all settings from LocalStorage
 */
export function clearSettings(): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error("Failed to clear settings:", e);
    }
}

/**
 * Check if API settings are configured
 * For Gemini: only apiKey is required (uses default endpoint)
 * For OpenAI: both endpoint and apiKey are required
 * For Vertex AI: gcpProject and apiKey are required
 */
export function isConfigured(): boolean {
    const settings = getSettings();

    // 所有类型都需要 apiKey
    if (!settings.apiKey) {
        return false;
    }

    // OpenAI 需要 endpoint
    if (settings.apiType === 'openai' && !settings.endpoint) {
        return false;
    }

    // Vertex AI 需要 project 和 location
    if (settings.apiType === 'vertexai' && (!settings.gcpProject || !settings.gcpLocation)) {
        return false;
    }

    return true;
}
