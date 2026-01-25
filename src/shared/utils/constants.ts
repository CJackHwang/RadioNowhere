/**
 * Radio Nowhere - 全局常量配置
 * 所有可调参数集中管理
 */

// ================== 电台配置 ==================

export const RADIO = {
    NAME: 'NOWHERE',                  // 电台名称
    FREQUENCY: 'FM 404.2',            // 电台频率
    SLOGAN: '无处不在的陪伴',           // 电台口号
};

// ================== 节目时长配置 ==================

export const SHOW = {
    MAIN_DURATION: 480,               // 主节目时长 (秒) - 8分钟
    PREGENERATE_DURATION: 240,        // 预生成节目时长 (秒) - 4分钟
    DEFAULT_TIMELINE_DURATION: 120,   // 默认时间线时长 (秒)
};

// ================== 过渡音乐配置 ==================

export const TRANSITION = {
    MIN_DURATION_MS: 30000,           // 最短过渡时长 (ms) - 30秒
    MAX_DURATION_MS: 45000,           // 最长过渡时长 (ms) - 45秒
    MUSIC_VOLUME: 0.5,                // 过渡音乐音量
    FADE_IN_MS: 2000,                 // 淡入时长 (ms)
    FADE_OUT_MS: 2000,                // 淡出时长 (ms)
    SEARCH_QUERIES: ['轻音乐', '钢琴曲', '纯音乐', 'ambient', 'piano'],
};

// ================== 音频配置 ==================

export const AUDIO = {
    // 音量
    MUSIC_DEFAULT_VOLUME: 1.0,        // 音乐默认音量（与TTS一致，实现平衡）
    VOICE_DEFAULT_VOLUME: 1.0,        // 语音默认音量
    MASTER_DEFAULT_VOLUME: 0.85,      // 主音量
    MUSIC_DURING_VOICE: 0.15,         // 语音播放时音乐音量
    MUSIC_FADE_LOW: 0.1,              // 音乐最低淡入淡出音量
    MUSIC_AFTER_TRANSITION: 0.9,      // 过渡后恢复音量
    MUSIC_DEFAULT_FADE_IN: 2000,      // 音乐默认渐入时长 (ms)

    // 淡入淡出时长 (ms)
    FADE_DURATION_QUICK: 500,         // 快速淡入淡出
    FADE_DURATION_NORMAL: 1000,       // 正常淡入淡出
    FADE_DURATION_SLOW: 2000,         // 慢速淡入淡出

    // 超时设置 (ms)
    MUSIC_LOAD_TIMEOUT: 30000,        // 音乐加载超时
    TTS_TIMEOUT: 30000,               // TTS 生成超时

    // 延迟设置 (ms)
    BLOCK_TRANSITION_DELAY: 300,      // 块切换延迟
    POST_TRANSITION_DELAY: 500,       // 过渡后延迟
    ERROR_RECOVERY_DELAY: 3000,       // 错误恢复延迟
    PAUSE_CHECK_INTERVAL: 100,        // 暂停检查间隔
};

// ================== Agent 配置 ==================

export const AGENT = {
    // Writer Agent
    MAX_REACT_LOOPS: 30,              // ReAct 最大循环次数
    MAX_PARSE_RETRIES: 3,             // 解析重试次数
    MAX_OUTPUT_TOKENS: 8192,          // AI 最大输出 token 数

    // Director Agent
    PRELOAD_BLOCKS_DEFAULT: 5,        // 默认预加载块数（增加到 5 块）
    HALFWAY_DELAY_MIN_MS: 5000,       // 预生成最小等待时间

    // TTS Agent
    MAX_CONCURRENT_TTS: 5,            // TTS 最大并发数（降低以避免 503）
    API_RETRY_COUNT: 3,               // API 重试次数
    API_RETRY_BASE_DELAY: 1000,       // API 重试基础延迟 (ms)
};

// ================== 历史记录配置 ==================

export const HISTORY = {
    MAX_RECENT_SHOWS: 50,             // 最大近期节目记录数
    MAX_RECENT_SONGS: 100,            // 最大近期歌曲记录数
    EXPIRY_HOURS: 2,                  // 历史过期时间 (小时)
    DUPLICATE_CHECK_HOURS: 1,         // 重复检查时间范围（小时）
};

// ================== 全局状态配置 ==================

export const STATE = {
    MAX_TRACK_HISTORY: 20,            // 最大曲目历史数
    MAX_TOPIC_HISTORY: 30,            // 最大话题历史数
    COMPRESS_THRESHOLD: 25,           // 压缩阈值
};

// ================== 整点报时配置 ==================

export const TIME_ANNOUNCEMENT = {
    TRIGGER_BEFORE_MS: 6000,          // 提前触发时间 (ms) - 54秒时触发
    RESUME_DELAY_MS: 3000,            // 报时后恢复延迟 (ms)
    CHECK_INTERVAL_MS: 1000,          // 检查间隔 (ms)
};

// ================== UI 配置 ==================

export const UI = {
    SUBTITLE_VISIBLE_DURATION: 5000,  // 字幕显示时长 (ms)
    AGENT_MONITOR_MAX_LOGS: 30,       // Agent Monitor 最大日志数
    AGENT_MONITOR_MAX_THOUGHTS: 20,   // Agent Monitor 最大思考数
    TIMELINE_HISTORY_LIMIT: 60,       // 时间线历史限制 (块数)
};

// ================== 音乐服务配置 ==================

export const MUSIC_SERVICE = {
    DEFAULT_SEARCH_COUNT: 10,         // 默认搜索结果数
    DEFAULT_BITRATE: 320,             // 默认音质
    API_BASE_URL: 'https://music-api.gdstudio.xyz/api.php',
};

// ================== 新闻服务配置 ==================

export const NEWS_SERVICE = {
    API_KEY: 'xQoCR8nqbnaUO8vFOKVSGuijbI',
    API_URL: 'https://api.shwgij.com/api/news/fastnews/news_rest',
    DEFAULT_COUNT: 10,                // 默认新闻条数
    MAX_COUNT: 15,                    // 最大新闻条数
};
