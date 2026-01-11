/**
 * Voice Provider - 统一音色提供接口
 * 根据当前 TTS 渠道动态返回可用音色列表
 */

import { getSettings } from './settings_store';
import { TTS_VOICES, TTSVoice } from './tts_voices';
import { MICROSOFT_TTS_VOICES, MicrosoftTTSVoice } from './microsoft_tts_voices';

// ================== Unified Voice Interface ==================

export interface UnifiedVoice {
    id: string;              // 音色 ID (用于 TTS API)
    name: string;            // 显示名称
    gender: 'male' | 'female' | 'neutral';
    language: 'zh' | 'en' | 'ja' | 'multi';
    style: string;           // 风格描述
}

// ================== Voice Converters ==================

/**
 * Gemini 音色转换
 */
function convertGeminiVoice(voice: TTSVoice): UnifiedVoice {
    return {
        id: voice.name,
        name: voice.name,
        gender: voice.gender,
        language: voice.language,
        style: voice.style
    };
}

/**
 * Microsoft 音色转换
 */
function convertMicrosoftVoice(voice: MicrosoftTTSVoice): UnifiedVoice {
    return {
        id: voice.name,  // 使用简短名称如 "XiaoxiaoNeural"
        name: voice.displayName,
        gender: voice.gender === 'Female' ? 'female' : 'male',
        language: voice.language,
        style: voice.style || 'Default'
    };
}

// ================== Public API ==================

/**
 * Edge TTS 已验证可用的音色白名单
 * 基于 edge-tts --list-voices 确认支持的音色
 */
const VERIFIED_EDGE_VOICES = new Set([
    // 中文 (zh-CN) - 核心音色
    'XiaoxiaoNeural',     // 晓晓 - 女声，最常用
    'XiaoyiNeural',       // 晓伊 - 女声
    'YunyangNeural',      // 云扬 - 男声，新闻专业
    'YunxiaNeural',       // 云夏 - 男声，童声
    'YunjianNeural',      // 云健 - 男声
    'YunxiNeural',        // 云希 - 男声
    // 英文 (en-US) - 已验证音色
    'AriaNeural',         // Aria - 女声
    'JennyNeural',        // Jenny - 女声
    'GuyNeural',          // Guy - 男声
    'ChristopherNeural',  // Christopher - 男声
    'EricNeural',         // Eric - 男声
    'MichelleNeural',     // Michelle - 女声
    'RogerNeural',        // Roger - 男声
    'SteffanNeural',      // Steffan - 男声
    // 日语 (ja-JP) - 已验证音色
    'NanamiNeural',       // Nanami - 女声
    'KeitaNeural',        // Keita - 男声
    'MayuNeural',         // Mayu - 女声
    'NaokiNeural',        // Naoki - 男声
]);

/**
 * 获取当前 TTS 渠道可用的音色列表
 */
export function getAvailableVoices(): UnifiedVoice[] {
    const settings = getSettings();

    if (settings.ttsProvider === 'microsoft') {
        // 只返回 Edge TTS 已验证支持的音色
        return MICROSOFT_TTS_VOICES
            .filter(v => VERIFIED_EDGE_VOICES.has(v.name))
            .map(convertMicrosoftVoice);
    }

    return TTS_VOICES.map(convertGeminiVoice);
}

/**
 * 根据性别筛选音色
 */
export function getVoicesByGender(gender: 'male' | 'female' | 'neutral'): UnifiedVoice[] {
    return getAvailableVoices().filter(v => v.gender === gender);
}

/**
 * 根据语言筛选音色
 */
export function getVoicesByLanguage(lang: 'zh' | 'en' | 'ja' | 'multi'): UnifiedVoice[] {
    return getAvailableVoices().filter(v => v.language === lang || v.language === 'multi');
}

/**
 * 生成 AI Prompt 用的音色列表描述
 * 用于注入到 Writer Agent 的 prompt 中
 */
export function getVoiceListForPrompt(): string {
    const settings = getSettings();
    const voices = getAvailableVoices();
    const provider = settings.ttsProvider === 'microsoft' ? '微软 Azure Neural TTS' : 'Google Gemini TTS';

    // 按语言分组
    const zhVoices = voices.filter(v => v.language === 'zh');
    const enVoices = voices.filter(v => v.language === 'en');
    const jaVoices = voices.filter(v => v.language === 'ja');
    const multiVoices = voices.filter(v => v.language === 'multi');

    let prompt = `## 可用音色 (${provider})

请为每个主持人/角色选择合适的音色，在 scripts 中使用 voiceName 字段指定。

### 中文音色
${zhVoices.slice(0, 10).map(v => `- \`${v.id}\`: ${v.name} (${v.gender === 'female' ? '女' : v.gender === 'male' ? '男' : '中性'}) - ${v.style}`).join('\n')}
`;

    if (enVoices.length > 0) {
        prompt += `
### 英文音色
${enVoices.slice(0, 5).map(v => `- \`${v.id}\`: ${v.name} (${v.gender === 'female' ? '女' : '男'}) - ${v.style}`).join('\n')}
`;
    }

    if (jaVoices.length > 0) {
        prompt += `
### 日语音色
${jaVoices.slice(0, 5).map(v => `- \`${v.id}\`: ${v.name} (${v.gender === 'female' ? '女' : '男'}) - ${v.style}`).join('\n')}
`;
    }

    if (multiVoices.length > 0 && settings.ttsProvider !== 'microsoft') {
        prompt += `
### 多语言通用音色
${multiVoices.slice(0, 5).map(v => `- \`${v.id}\`: ${v.name} (${v.gender === 'female' ? '女' : v.gender === 'male' ? '男' : '中性'}) - ${v.style}`).join('\n')}
`;
    }

    prompt += `
**重要**: 在 scripts 中必须使用 \`voiceName\` 字段指定音色 ID，例如:
\`\`\`json
{
  "speaker": "host1",
  "voiceName": "${voices[0]?.id || 'XiaoxiaoNeural'}",
  "text": "台词内容..."
}
\`\`\`
`;

    return prompt;
}

/**
 * 根据音色 ID 获取完整的 Microsoft TTS voice 名称
 * 用于构建 API 请求
 */
export function getMicrosoftFullVoiceName(voiceId: string): string {
    // 如果已经是完整格式，直接返回
    if (voiceId.includes('Microsoft Server Speech')) {
        return voiceId;
    }

    // 查找匹配的音色
    const voice = MICROSOFT_TTS_VOICES.find(v => v.name === voiceId);
    if (voice) {
        return voice.fullName;
    }

    // 默认返回晓晓
    return 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)';
}

/**
 * 获取当前 TTS 渠道名称
 */
export function getCurrentTTSProvider(): 'gemini' | 'microsoft' {
    return getSettings().ttsProvider;
}
