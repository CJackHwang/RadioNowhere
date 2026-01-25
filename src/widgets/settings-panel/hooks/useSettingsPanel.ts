"use client";

import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings, IApiSettings, ApiType, DEFAULT_SETTINGS } from '@shared/services/storage-service/settings';
import { testConnection, fetchModels } from '@shared/services/ai-service';
import { SettingsPanelState, SettingsPanelActions, TestStatus } from '../types';

// Constants
const MS_TTS_DEFAULT_TOKEN = 'tetr5354';

export function useSettingsPanel(isOpen: boolean): SettingsPanelState & SettingsPanelActions {
    const [settings, setSettings] = useState<IApiSettings>(DEFAULT_SETTINGS);
    const [testStatus, setTestStatus] = useState<TestStatus>("idle");
    const [testMessage, setTestMessage] = useState("");
    const [saved, setSaved] = useState(false);

    const [models, setModels] = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    const [ttsTestStatus, setTtsTestStatus] = useState<TestStatus>("idle");
    const [ttsTestMessage, setTtsTestMessage] = useState("");

    // Load settings on mount
    useEffect(() => {
        if (isOpen) {
            const stored = getSettings();
            setTimeout(() => {
                setSettings(stored);
                setTestStatus("idle");
                setTestMessage("");
                setSaved(false);
                setModels([]);
                setShowModelDropdown(false);
            }, 0);
        }
    }, [isOpen]);

    const handleFetchModels = useCallback(async () => {
        if (!settings.endpoint || !settings.apiKey) return;

        setLoadingModels(true);
        const modelList = await fetchModels(settings.endpoint, settings.apiKey, settings.apiType);
        setModels(modelList);
        setLoadingModels(false);

        if (modelList.length > 0) {
            setShowModelDropdown(true);
        }
    }, [settings.endpoint, settings.apiKey, settings.apiType]);

    const handleSave = useCallback(() => {
        saveSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }, [settings]);

    const handleTest = useCallback(async () => {
        setTestStatus("testing");
        setTestMessage("");

        saveSettings(settings);

        const result = await testConnection();
        setTestStatus(result.success ? "success" : "error");
        setTestMessage(result.message);

        if (result.success && models.length === 0) {
            handleFetchModels();
        }
    }, [settings, models.length, handleFetchModels]);

    const handleChange = useCallback((field: keyof IApiSettings, value: string | boolean | number) => {
        setSaved(false);

        if (field === 'apiType') {
            const apiTypeValue = value as ApiType;

            setSettings(prev => {
                let defaultEndpoint = prev.endpoint;
                let defaultModel = prev.modelName;

                if (apiTypeValue === 'gemini') {
                    defaultEndpoint = 'https://generativelanguage.googleapis.com';
                    defaultModel = 'gemini-2.5-flash';
                } else if (apiTypeValue === 'vertexai') {
                    defaultEndpoint = '';
                    defaultModel = 'gemini-2.5-flash';
                } else if (apiTypeValue === 'openai') {
                    defaultEndpoint = '';
                    defaultModel = 'gpt-4o';
                }

                return {
                    ...prev,
                    apiType: apiTypeValue,
                    endpoint: defaultEndpoint,
                    modelName: defaultModel
                };
            });
        } else {
            setSettings(prev => ({ ...prev, [field]: value }));
        }
    }, []);

    const handleTtsTest = useCallback(async () => {
        setTtsTestStatus("testing");
        setTtsTestMessage("正在测试 TTS...");

        try {
            if (settings.ttsProvider === 'microsoft') {
                const endpoint = (settings.msTtsEndpoint || 'https://tts.cjack.top').replace(/\/$/, '');
                const voice = encodeURIComponent('Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)');
                const url = `${endpoint}/api/text-to-speech?voice=${voice}&volume=100&rate=0&pitch=0&text=${encodeURIComponent('测试')}`;

                const token = settings.msTtsAuthKey || MS_TTS_DEFAULT_TOKEN;
                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType?.includes('audio')) {
                        setTtsTestStatus("success");
                        setTtsTestMessage("✅ 微软 TTS 连接成功!");
                    } else {
                        setTtsTestStatus("error");
                        setTtsTestMessage(`❌ 返回类型错误: ${contentType}`);
                    }
                } else {
                    const err = await response.text();
                    setTtsTestStatus("error");
                    setTtsTestMessage(`❌ ${response.status}: ${err.slice(0, 50)}`);
                }
            } else {
                const ttsKey = settings.ttsApiKey || settings.apiKey;
                if (!ttsKey) {
                    setTtsTestStatus("error");
                    setTtsTestMessage("请先填写 API Key");
                    return;
                }

                let apiUrl = '';
                const method = 'POST';
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };

                if (settings.apiType === 'vertexai' && settings.ttsUseVertex) {
                    const model = settings.ttsModel || 'gemini-2.5-flash';
                    const isGcpApiKey = settings.apiKey.startsWith('AIza');
                    apiUrl = `https://${settings.gcpLocation}-aiplatform.googleapis.com/v1/projects/${settings.gcpProject}/locations/${settings.gcpLocation}/publishers/google/models/${model}:generateContent` + (isGcpApiKey ? `?key=${settings.apiKey}` : '');

                    if (!isGcpApiKey) {
                        headers['Authorization'] = `Bearer ${settings.apiKey}`;
                    }
                } else {
                    const baseUrl = settings.ttsEndpoint || 'https://generativelanguage.googleapis.com';
                    const ttsModel = settings.ttsModel || 'gemini-2.5-flash-preview-tts';
                    apiUrl = `${baseUrl}/v1beta/models/${ttsModel}:generateContent`;
                    headers['x-goog-api-key'] = ttsKey;
                }

                const response = await fetch('/api/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: apiUrl,
                        method,
                        headers,
                        body: {
                            contents: [{ role: "user", parts: [{ text: 'Say the following text: 这是一个测试。' }] }],
                            generationConfig: {
                                responseModalities: ['AUDIO'],
                                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
                            }
                        }
                    })
                });

                if (response.ok) {
                    setTtsTestStatus("success");
                    setTtsTestMessage("✅ Gemini TTS 连接成功!");
                } else {
                    const err = await response.text();
                    setTtsTestStatus("error");
                    setTtsTestMessage(`❌ ${response.status}: ${err.slice(0, 200)}`);
                }
            }
        } catch (e) {
            setTtsTestStatus("error");
            setTtsTestMessage(`❌ 连接失败: ${e}`);
        }
    }, [settings]);

    const handleSelectModel = useCallback((model: string) => {
        handleChange("modelName", model);
        setShowModelDropdown(false);
    }, [handleChange]);

    return {
        // State
        settings,
        testStatus,
        testMessage,
        saved,
        models,
        loadingModels,
        showModelDropdown,
        ttsTestStatus,
        ttsTestMessage,
        // Actions
        handleChange,
        handleSave,
        handleTest,
        handleFetchModels,
        handleTtsTest,
        handleSelectModel,
        setShowModelDropdown,
    };
}
