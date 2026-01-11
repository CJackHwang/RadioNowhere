import { getSettings, isConfigured, ApiType } from "./settings_store";
import { WORLD_BIBLE, IShowSegment } from "./fictional_world";
import { radioMonitor } from "./radio_monitor";

// ================== Interfaces ==================

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{ text: string }>;
        };
    }>;
}

// ================== Helper Functions ==================

/**
 * 规范化 API endpoint
 */
function normalizeEndpoint(endpoint: string, apiType: ApiType): string {
    let url = endpoint.replace(/\/$/, '');

    if (apiType === 'openai') {
        if (!url.endsWith('/v1')) {
            url = `${url}/v1`;
        }
    } else if (apiType === 'gemini') {
        // Gemini: ensure ends with /v1 or /v1beta
        if (!url.endsWith('/v1') && !url.endsWith('/v1beta')) {
            url = `${url}/v1beta`;
        }
    }
    // vertexai 不需要处理，URL 由 buildVertexUrl 生成
    if (apiType === 'vertexai') {
        return '';
    }

    return url;
}

/**
 * 构建 Vertex AI URL
 */
export function buildVertexUrl(project: string, location: string, model: string, task: string): string {
    // 允许用户输入完整模型名或简写
    const modelFull = model.includes('/') ? model : `models/${model}`;
    const taskMethod = task.startsWith(':') ? task : `:${task}`;
    return `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/${modelFull}${taskMethod}`;
}

/**
 * 解析 URL 获取服务类型
 */
function getServiceFromUrl(url: string): 'AI' | 'TTS' | 'Music' | 'Lyrics' | 'Proxy' {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('generatecontent')) {
        if (lowerUrl.includes('tts') || lowerUrl.includes('speech')) return 'TTS';
        return 'AI';
    }
    if (lowerUrl.includes('music-api') || lowerUrl.includes('gdstudio')) {
        if (lowerUrl.includes('lyric')) return 'Lyrics';
        return 'Music';
    }
    return 'Proxy';
}

/**
 * 从 URL 提取简短动作描述
 */
function getActionFromUrl(url: string): string {
    if (url.includes('generateContent')) return 'Generate Content';
    if (url.includes('search')) return 'Search Music';
    if (url.includes('types=url')) return 'Get Music URL';
    if (url.includes('types=lyric')) return 'Fetch Lyrics';
    if (url.includes('models')) return 'Fetch Models';
    return 'API Request';
}

/**
 * 发送 API 请求（直接调用，如失败则尝试代理）
 */
export async function apiFetch(
    url: string,
    options: { method: string; headers: Record<string, string>; body?: unknown; signal?: AbortSignal }
): Promise<Response> {
    const fetchOptions: RequestInit = {
        method: options.method,
        headers: options.headers,
        signal: options.signal,
    };

    if (options.body && options.method !== 'GET') {
        fetchOptions.body = JSON.stringify(options.body);
    }

    const service = getServiceFromUrl(url);
    const action = getActionFromUrl(url);
    const callId = radioMonitor.startApiCall(service, action);

    try {
        // 尝试直接调用
        const response = await fetch(url, fetchOptions);
        radioMonitor.endApiCall(callId, response.ok, response.ok ? undefined : `${response.status}`);
        return response;
    } catch (directError) {
        // 如果是中止信号导致的错误，直接抛出
        if (options.signal?.aborted) {
            radioMonitor.endApiCall(callId, false, 'aborted');
            throw directError;
        }

        console.log("Direct fetch failed, trying proxy...", directError);
        // fallback 到代理
        try {
            const response = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    method: options.method,
                    headers: options.headers,
                    body: options.body
                }),
                signal: options.signal,
            });
            radioMonitor.endApiCall(callId, response.ok, 'via proxy');
            return response;
        } catch (proxyError) {
            console.error("Proxy also failed:", proxyError);
            radioMonitor.endApiCall(callId, false, 'failed');
            throw directError; // 抛出原始错误
        }
    }
}

// ================== Unified AI Call Helper ==================

export interface GenerativeAIOptions {
    prompt: string;
    temperature?: number;
    maxOutputTokens?: number;
}

/**
 * 统一的 AI 调用辅助函数
 * 自动处理 OpenAI / Gemini / Vertex AI 三种格式
 */
export async function callGenerativeAI(options: GenerativeAIOptions): Promise<string | null> {
    const settings = getSettings();
    const { prompt, temperature = 0.7, maxOutputTokens = 2048 } = options;

    let url: string;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: unknown;

    if (settings.apiType === 'vertexai') {
        // Vertex AI 格式
        const isGcpApiKey = settings.apiKey.startsWith('AIza');
        url = buildVertexUrl(
            settings.gcpProject,
            settings.gcpLocation,
            settings.modelName,
            'generateContent'
        );

        if (isGcpApiKey) {
            url += `?key=${settings.apiKey}`;
        } else {
            headers['Authorization'] = `Bearer ${settings.apiKey}`;
        }

        body = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens }
        };
    } else if (settings.apiType === 'gemini') {
        // Gemini 格式
        const endpoint = settings.endpoint || 'https://generativelanguage.googleapis.com';
        const baseUrl = normalizeEndpoint(endpoint, 'gemini');
        url = `${baseUrl}/models/${settings.modelName}:generateContent`;
        headers['x-goog-api-key'] = settings.apiKey;
        body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens }
        };
    } else {
        // OpenAI 格式
        const endpoint = settings.endpoint || '';
        const baseUrl = normalizeEndpoint(endpoint, 'openai');
        url = `${baseUrl}/chat/completions`;
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
        body = {
            model: settings.modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            max_tokens: maxOutputTokens
        };
    }

    try {
        const response = await apiFetch(url, { method: 'POST', headers, body });

        if (!response.ok) {
            console.error(`AI API Error: ${response.status}`);
            return null;
        }

        const data = await response.json();

        // 根据 API 类型解析响应
        if (settings.apiType === 'openai') {
            return data.choices?.[0]?.message?.content || null;
        } else {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }
    } catch (error) {
        console.error('callGenerativeAI error:', error);
        return null;
    }
}


// ================== Main Functions ==================

/**
 * Generate content using OpenAI or Gemini API
 */
export async function generateSegment(historyLines: string[]): Promise<IShowSegment> {
    if (!isConfigured()) {
        return {
            type: "host_talk",
            content: "System Error: Neural Link Severed. (No API Configured - Check Settings)"
        };
    }

    const settings = getSettings();
    // 使用默认 Gemini endpoint 如果未设置
    const endpoint = settings.endpoint ||
        (settings.apiType === 'gemini' ? 'https://generativelanguage.googleapis.com' : '');
    const baseUrl = normalizeEndpoint(endpoint, settings.apiType);

    const history = historyLines.join("\n");
    const prompt = `
${WORLD_BIBLE}

HISTORY OF BROADCAST:
${history}

TASK:
Generate the next short segment for the radio broadcast.
Choose ONE of these types:

1. 'host_talk': Casual conversation from the host (max 30 words). Share thoughts, comment on the city, interact with listeners.

2. 'news': Breaking news flash about the fictional world (max 20 words). Keep it dramatic and dystopian.

3. 'music_intro': Introduce the next song (max 25 words). You MUST include "music_keyword" - a real song name and/or artist to search for. Choose music that fits the late-night, melancholic, smooth vibe. Can be any genre: electronic, lo-fi, jazz, ambient, post-rock, or classic songs.

OUTPUT FORMAT (strict JSON only):
{
  "type": "host_talk" | "news" | "music_intro",
  "content": "your speech text here...",
  "music_keyword": "song name or artist name"  // ONLY for music_intro type
}

IMPORTANT:
- For music_intro, the music_keyword should be a REAL song or artist name that can be found on music platforms
- Vary the segment types - don't repeat the same type consecutively
- Keep the dystopian radio host persona
`;

    try {
        let responseText: string;

        if (settings.apiType === 'vertexai') {
            // Vertex AI format
            const isGcpApiKey = settings.apiKey.startsWith('AIza');
            const url = buildVertexUrl(
                settings.gcpProject,
                settings.gcpLocation,
                settings.modelName,
                'generateContent'
            ) + (isGcpApiKey ? `?key=${settings.apiKey}` : '');

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };

            if (!isGcpApiKey) {
                headers["Authorization"] = `Bearer ${settings.apiKey}`;
            }

            const response = await apiFetch(url, {
                method: "POST",
                headers,
                body: {
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 300,
                    }
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Vertex AI API Error:", response.status, errorText);
                return { type: "host_talk", content: "Signal interference detected..." };
            }

            const data: GeminiResponse = await response.json();
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else if (settings.apiType === 'gemini') {
            // Gemini native format
            const response = await apiFetch(
                `${baseUrl}/models/${settings.modelName}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": settings.apiKey,
                    },
                    body: {
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 300,
                        }
                    }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Gemini API Error:", response.status, errorText);
                return { type: "host_talk", content: "Signal interference detected..." };
            }

            const data: GeminiResponse = await response.json();
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
            // OpenAI format
            const response = await apiFetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${settings.apiKey}`,
                },
                body: {
                    model: settings.modelName,
                    messages: [{ role: "user", content: prompt }] as ChatMessage[],
                    temperature: 0.8,
                    max_tokens: 300,
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("OpenAI API Error:", response.status, errorText);
                return { type: "host_talk", content: "Signal interference detected..." };
            }

            const data: OpenAIResponse = await response.json();
            responseText = data.choices?.[0]?.message?.content || "";
        }

        // Parse JSON from response (handle markdown code blocks)
        const text = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(text) as IShowSegment;
    } catch (error) {
        console.error("AI Generation Error:", error);
        return { type: "host_talk", content: "Static interference..." };
    }
}

/**
 * Test API connection
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
    if (!isConfigured()) {
        return { success: false, message: "API not configured" };
    }

    const settings = getSettings();
    // 使用默认 Gemini endpoint 如果未设置
    const endpoint = settings.endpoint ||
        (settings.apiType === 'gemini' ? 'https://generativelanguage.googleapis.com' : '');
    const baseUrl = normalizeEndpoint(endpoint, settings.apiType);

    try {
        if (settings.apiType === 'vertexai') {
            // Vertex AI test
            const isGcpApiKey = settings.apiKey.startsWith('AIza');
            const url = buildVertexUrl(
                settings.gcpProject,
                settings.gcpLocation,
                settings.modelName,
                'generateContent'
            ) + (isGcpApiKey ? `?key=${settings.apiKey}` : '');

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };

            if (!isGcpApiKey) {
                headers["Authorization"] = `Bearer ${settings.apiKey}`;
            }

            const response = await apiFetch(url, {
                method: "POST",
                headers,
                body: {
                    contents: [{ role: "user", parts: [{ text: "Hi" }] }],
                    generationConfig: { maxOutputTokens: 5 }
                }
            });

            if (response.ok) {
                return { success: true, message: "✅ Vertex AI connection successful!" };
            } else {
                const errorText = await response.text();
                return { success: false, message: `Error: ${response.status} - ${errorText.slice(0, 100)}` };
            }
        } else if (settings.apiType === 'gemini') {
            // Gemini test
            const response = await apiFetch(
                `${baseUrl}/models/${settings.modelName}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": settings.apiKey,
                    },
                    body: {
                        contents: [{ parts: [{ text: "Hi" }] }],
                        generationConfig: { maxOutputTokens: 5 }
                    }
                }
            );

            if (response.ok) {
                return { success: true, message: "✅ Gemini connection successful!" };
            } else {
                const errorText = await response.text();
                return { success: false, message: `Error: ${response.status} - ${errorText.slice(0, 100)}` };
            }
        } else {
            // OpenAI test
            const response = await apiFetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${settings.apiKey}`,
                },
                body: {
                    model: settings.modelName,
                    messages: [{ role: "user", content: "Hi" }],
                    max_tokens: 5,
                }
            });

            if (response.ok) {
                return { success: true, message: "✅ OpenAI connection successful!" };
            } else {
                const errorText = await response.text();
                return { success: false, message: `Error: ${response.status} - ${errorText.slice(0, 100)}` };
            }
        }
    } catch (error) {
        return { success: false, message: `Connection failed: ${error}` };
    }
}

/**
 * Fetch available models from the API
 */
export async function fetchModels(endpoint: string, apiKey: string, apiType: ApiType): Promise<string[]> {
    if (!endpoint || !apiKey) {
        return [];
    }

    const baseUrl = normalizeEndpoint(endpoint, apiType);

    try {
        // 根据 API 类型使用不同的认证头
        const headers: Record<string, string> = apiType === 'gemini'
            ? { "x-goog-api-key": apiKey }
            : { "Authorization": `Bearer ${apiKey}` };

        const response = await apiFetch(`${baseUrl}/models`, {
            method: "GET",
            headers,
        });

        if (!response.ok) {
            console.error("Failed to fetch models:", response.status);
            return [];
        }

        const data = await response.json();

        // OpenAI format: { data: [{ id: "model-name", ... }] }
        if (data.data && Array.isArray(data.data)) {
            return data.data
                .map((model: { id: string }) => model.id)
                .sort((a: string, b: string) => a.localeCompare(b));
        }

        // Gemini format: { models: [{ name: "models/gemini-2.5-flash", ... }] }
        if (data.models && Array.isArray(data.models)) {
            return data.models
                .map((model: { name: string }) => model.name.replace('models/', ''))
                .sort((a: string, b: string) => a.localeCompare(b));
        }

        return [];
    } catch (error) {
        console.error("Error fetching models:", error);
        return [];
    }
}
