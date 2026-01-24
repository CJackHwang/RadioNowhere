/**
 * Radio Types - 电台系统类型定义
 * 积木式数据结构，供 AI 生成和系统解析
 */

// ================== 基础类型 ==================

/** 主持人 ID */
export type SpeakerId = 'host1' | 'host2' | 'guest' | 'news' | 'announcer';

/** 音乐控制动作 */
export type MusicAction = 'play' | 'pause' | 'resume' | 'fade_out' | 'fade_in' | 'stop';

/** 情绪/语气类型 */
export type MoodType =
  | 'cheerful'    // 开朗
  | 'calm'        // 平静
  | 'excited'     // 兴奋
  | 'serious'     // 严肃
  | 'warm'        // 温暖
  | 'playful'     // 俏皮
  | 'melancholy'  // 忧郁
  | 'mysterious'; // 神秘

// ================== 语音配置 ==================

/** Gemini TTS 音色配置 */
export interface VoiceProfile {
  voiceName: string;     // Gemini voice name (Aoede, Gacrux 等)
  gender: 'male' | 'female' | 'neutral';
  style: string;         // 默认风格描述
  description: string;   // 角色描述
}

/** 预设音色表 */
export const VOICE_PROFILES: Record<SpeakerId, VoiceProfile> = {
  host1: {
    voiceName: 'Aoede',
    gender: 'female',
    style: '温柔知性，声音清澈',
    description: '女主持人，擅长情感话题和深夜陪伴'
  },
  host2: {
    voiceName: 'Gacrux',
    gender: 'male',
    style: '轻松幽默，有磁性',
    description: '男主持人，擅长音乐推荐和趣味闲聊'
  },
  guest: {
    voiceName: 'Puck',
    gender: 'neutral',
    style: '活泼开朗',
    description: '嘉宾或特别角色'
  },
  news: {
    voiceName: 'Charon',
    gender: 'male',
    style: '专业稳重',
    description: '新闻播报员'
  },
  announcer: {
    voiceName: 'Kore',
    gender: 'female',
    style: '专业严肃',
    description: '整点报时播报员'
  }
};

/** 全部 30 种 Gemini TTS 音色 - AI 可动态选择 */
export const ALL_VOICES = {
  // 中文推荐
  Aoede: { gender: 'female', lang: 'zh', style: 'Breezy', desc: '清澈温柔，适合深夜电台' },
  Kore: { gender: 'female', lang: 'zh', style: 'Firm', desc: '坚定专业，适合新闻播报' },
  Gacrux: { gender: 'male', lang: 'zh', style: 'Mature', desc: '成熟稳重，适合文化节目' },
  Charon: { gender: 'male', lang: 'zh', style: 'Informative', desc: '专业播报，适合新闻资讯' },
  Puck: { gender: 'neutral', lang: 'zh', style: 'Upbeat', desc: '活泼开朗，适合综艺娱乐' },

  // 英文推荐
  Zephyr: { gender: 'female', lang: 'en', style: 'Bright', desc: 'Clear and bright voice' },
  Fenrir: { gender: 'male', lang: 'en', style: 'Excitable', desc: 'Energetic and engaging' },
  Leda: { gender: 'female', lang: 'en', style: 'Youthful', desc: 'Young and fresh' },
  Orus: { gender: 'male', lang: 'en', style: 'Firm', desc: 'Confident and professional' },
  Callirrhoe: { gender: 'female', lang: 'en', style: 'Confident', desc: 'Authoritative and clear' },

  // 日文推荐
  Despina: { gender: 'female', lang: 'ja', style: 'Warm', desc: '温かみのある女性声' },
  Autonoe: { gender: 'female', lang: 'ja', style: 'Bright Mature', desc: '落ち着いた大人の女性' },
  Umbriel: { gender: 'male', lang: 'ja', style: 'Easy-going', desc: 'リラックスした男性声' },
  Iapetus: { gender: 'male', lang: 'ja', style: 'Friendly', desc: '親しみやすい男性声' },

  // 其他音色
  Enceladus: { gender: 'male', lang: 'multi', style: 'Breathy', desc: '低沉气声感' },
  Algieba: { gender: 'male', lang: 'multi', style: 'Smooth', desc: '圆润顺滑' },
  Erinome: { gender: 'female', lang: 'multi', style: 'Clear', desc: '晶莹剔透' },
  Algenib: { gender: 'female', lang: 'multi', style: 'Warm Confident', desc: '温暖自信' },
  Rasalgethi: { gender: 'male', lang: 'multi', style: 'Conversational', desc: '对话感强' },
  Laomedeia: { gender: 'female', lang: 'multi', style: 'Upbeat', desc: '轻快活泼' },
  Achernar: { gender: 'female', lang: 'multi', style: 'Soft', desc: '柔软轻盈' },
  Alnilam: { gender: 'male', lang: 'multi', style: 'Energetic', desc: '充满活力' },
  Schedar: { gender: 'female', lang: 'multi', style: 'Even', desc: '平稳均匀' },
  Pulcherrima: { gender: 'female', lang: 'multi', style: 'Bright Youthful', desc: '明亮年轻' },
  Achird: { gender: 'male', lang: 'multi', style: 'Friendly', desc: '友好亲切' },
  Zubenelgenubi: { gender: 'male', lang: 'multi', style: 'Casual', desc: '轻松随意' },
  Vindemiatrix: { gender: 'female', lang: 'multi', style: 'Gentle', desc: '温柔细腻' },
  Sadachbia: { gender: 'male', lang: 'multi', style: 'Deep Confident', desc: '深沉自信' },
  Sadaltager: { gender: 'male', lang: 'multi', style: 'Knowledgeable', desc: '博学知性' },
  Sulafar: { gender: 'male', lang: 'multi', style: 'Warm', desc: '温暖舒适' },
} as const;

export type VoiceName = keyof typeof ALL_VOICES;

// ================== 节目时间线 ==================

/** 节目时间线 - 顶层结构 */
export interface ShowTimeline {
  id: string;
  title?: string;           // 节目标题
  estimatedDuration: number; // 预估总时长（秒）
  blocks: TimelineBlock[];   // 时间线块
  metadata?: {
    theme?: string;          // 节目主题
    mood?: MoodType;         // 整体氛围
    userRequest?: string;    // 用户投稿内容
  };
}

/** 时间线块 - 联合类型 */
export type TimelineBlock =
  | TalkBlock
  | MusicBlock
  | MusicControlBlock
  | SilenceBlock;

// ================== 块类型定义 ==================

/** 说话块 */
export interface TalkBlock {
  type: 'talk';
  id: string;
  scripts: ScriptLine[];      // 台词列表
  backgroundMusic?: {
    action: 'continue' | 'fade' | 'pause';
    volume?: number;          // 0-1，fade 时的目标音量
  };
}

/** 台词行 */
export interface ScriptLine {
  speaker: SpeakerId | string;  // 支持动态角色名
  text: string;
  voiceName?: string;           // TTS 音色名称（AI 可直接指定）
  mood?: MoodType;              // 情绪
  voiceStyle?: string;          // TTS 风格指令（自然语言）
  pause?: number;               // 台词后暂停毫秒数
}

/** 音乐播放块 */
export interface MusicBlock {
  type: 'music';
  id: string;
  action: 'play';
  search: string;             // 搜索关键词
  duration?: number;          // 播放时长（秒），不填则播完整首
  fadeIn?: number;            // 淡入时间（毫秒）
  intro?: ScriptLine;         // 音乐介绍词（播放前念）
}

/** 音乐控制块 */
export interface MusicControlBlock {
  type: 'music_control';
  id: string;
  action: Exclude<MusicAction, 'play'>;
  fadeDuration?: number;      // 淡入淡出时长（毫秒）
  targetVolume?: number;      // 目标音量 0-1
}

/** 静音块 */
export interface SilenceBlock {
  type: 'silence';
  id: string;
  duration: number;           // 静音时长（毫秒）
}

// ================== TTS 请求 ==================

/** TTS 生成请求 */
export interface TTSRequest {
  id: string;
  text: string;
  voiceName: string;
  stylePrompt: string;        // 完整的 TTS 风格提示
  priority: number;           // 1-10，数字越大优先级越高
  retryCount?: number;        // 已重试次数
}

/** TTS 生成结果 */
export interface TTSResult {
  id: string;
  success: boolean;
  audioData?: ArrayBuffer;    // 成功时的音频数据
  error?: string;             // 失败时的错误信息
  duration?: number;          // 音频时长（毫秒）
}

// ================== 播放状态 ==================

/** 播放器状态 */
export interface PlayerState {
  isPlaying: boolean;
  currentBlockId: string | null;
  musicState: {
    isPlaying: boolean;
    currentTrack: string | null;
    volume: number;
  };
  voiceState: {
    isPlaying: boolean;
    currentScriptId: string | null;
  };
  queue: {
    pending: number;          // 待处理块数
    ready: number;            // 已准备好的数
    generating: number;       // 正在生成的数
  };
}

// ================== Agent 通信 ==================

/** Agent 消息类型 */
export interface AgentMessage {
  from: 'director' | 'writer' | 'tts' | 'player';
  to: 'director' | 'writer' | 'tts' | 'player' | 'all';
  type: 'request' | 'response' | 'event' | 'error';
  payload: unknown;
  timestamp: number;
}

/** 错误信息 */
export interface RadioError {
  code: 'PARSE_ERROR' | 'TTS_ERROR' | 'MUSIC_ERROR' | 'NETWORK_ERROR';
  message: string;
  retryable: boolean;
  context?: unknown;
}
