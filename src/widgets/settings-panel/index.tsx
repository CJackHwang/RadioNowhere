"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Zap, CheckCircle, AlertCircle, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { getSettings, saveSettings, IApiSettings, ApiType, TTSProvider } from "@/lib/settings_store";
import { testConnection, fetchModels } from "@/lib/ai_service";

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const [settings, setSettings] = useState<IApiSettings>({
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
        // Playback
        preloadBlockCount: 3,
    });
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testMessage, setTestMessage] = useState("");
    const [saved, setSaved] = useState(false);

    // Model list state
    const [models, setModels] = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    // TTS test state
    const [ttsTestStatus, setTtsTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
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

    // Fetch models when endpoint/apiKey change
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

    const handleSave = () => {
        saveSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleTest = async () => {
        setTestStatus("testing");
        setTestMessage("");

        // Temporarily save for test
        saveSettings(settings);

        const result = await testConnection();
        setTestStatus(result.success ? "success" : "error");
        setTestMessage(result.message);

        // Auto-fetch models on successful connection
        if (result.success && models.length === 0) {
            handleFetchModels();
        }
    };

    const handleChange = (field: keyof IApiSettings, value: string | boolean | number) => {
        setSaved(false);

        // 自动填充默认 URL
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
            setSettings((prev) => ({ ...prev, [field]: value }));
        }
    };

    const handleTtsTest = async () => {
        setTtsTestStatus("testing");
        setTtsTestMessage("正在测试 TTS...");

        try {
            if (settings.ttsProvider === 'microsoft') {
                // Microsoft TTS Test - direct fetch with hardcoded token
                const endpoint = (settings.msTtsEndpoint || 'https://tts.cjack.top').replace(/\/$/, '');
                const voice = encodeURIComponent('Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)');
                const url = `${endpoint}/api/text-to-speech?voice=${voice}&volume=100&rate=0&pitch=0&text=${encodeURIComponent('测试')}`;

                // 优先使用自定义 token，留空则使用内置 token
                const token = settings.msTtsAuthKey || 'tetr5354';
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
                // Gemini TTS Test
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
                    // Vertex AI TTS Test
                    const model = settings.ttsModel || 'gemini-2.5-flash';
                    const isGcpApiKey = settings.apiKey.startsWith('AIza');
                    apiUrl = `https://${settings.gcpLocation}-aiplatform.googleapis.com/v1/projects/${settings.gcpProject}/locations/${settings.gcpLocation}/publishers/google/models/${model}:generateContent` + (isGcpApiKey ? `?key=${settings.apiKey}` : '');

                    if (!isGcpApiKey) {
                        headers['Authorization'] = `Bearer ${settings.apiKey}`;
                    }
                } else {
                    // Gemini Native TTS Test - 使用用户配置的 endpoint
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
    };

    const handleSelectModel = (model: string) => {
        handleChange("modelName", model);
        setShowModelDropdown(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-100"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-neutral-900 border border-neutral-700 rounded-2xl z-101 overflow-hidden shadow-2xl max-h-[85vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 sticky top-0 bg-neutral-900 z-20">
                            <h2 className="text-lg font-semibold text-white tracking-wide">API Settings</h2>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
                            >
                                <X size={20} className="text-neutral-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-5">
                            {/* API Type Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">API Type</label>
                                <div className="flex gap-2">
                                    {(["openai", "gemini", "vertexai"] as ApiType[]).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => handleChange("apiType", type)}
                                            className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${settings.apiType === type
                                                ? "bg-emerald-600 text-white"
                                                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                                                }`}
                                        >
                                            {type === "openai" ? "OpenAI" : type === "gemini" ? "Gemini" : "Vertex"}
                                        </button>
                                    ))}
                                </div>
                                <div className="text-xs text-neutral-500 mb-4 px-1">
                                    {settings.apiType === "openai"
                                        ? "兼容 OpenAI 格式的服务 (如 DeepSeek, Groq 等)"
                                        : settings.apiType === "gemini"
                                            ? "Google AI Studio 原生接口 (推荐 API Key 用户)"
                                            : "Google Cloud Vertex AI (仅支持 OAuth 认证)"}
                                </div>
                            </div>

                            {/* API Key / Access Token Input */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">
                                    {settings.apiType === 'vertexai' ? "Access Token" : "API Key"}
                                </label>
                                <input
                                    type="password"
                                    value={settings.apiKey}
                                    onChange={(e) => handleChange("apiKey", e.target.value)}
                                    placeholder={settings.apiType === 'vertexai' ? "ya29.a0AfH6S..." : "sk-..."}
                                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            {/* Vertex AI Specific Fields */}
                            {settings.apiType === "vertexai" && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="space-y-4"
                                >
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200">
                                        <p className="font-bold flex items-center gap-1 mb-1">
                                            <AlertCircle size={12} /> Vertex AI 验证方式
                                        </p>
                                        <p>Vertex 节点需使用 OAuth <strong>Access Token</strong>。</p>
                                        <p className="mt-1"><strong>获取方式：</strong>在 GCP 控制台右上角打开 <strong>Cloud Shell</strong> 并输入 <code>gcloud auth print-access-token</code>。</p>
                                        <p className="mt-2 opacity-80 italic border-t border-amber-500/20 pt-1">提示: 如果追求永久有效，请改用【Gemini】频道并填入 API Key (AIza...)。</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-neutral-400">GCP Project ID</label>
                                        <input
                                            type="text"
                                            value={settings.gcpProject}
                                            onChange={(e) => handleChange("gcpProject", e.target.value)}
                                            placeholder="my-project-id"
                                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-neutral-400">GCP Location</label>
                                        <input
                                            type="text"
                                            value={settings.gcpLocation}
                                            onChange={(e) => handleChange("gcpLocation", e.target.value)}
                                            placeholder="us-central1"
                                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {settings.apiType !== "vertexai" && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-neutral-400">API Endpoint</label>
                                    <input
                                        type="text"
                                        value={settings.endpoint}
                                        onChange={(e) => handleChange("endpoint", e.target.value)}
                                        placeholder={settings.apiType === "openai"
                                            ? "https://api.openai.com"
                                            : "https://generativelanguage.googleapis.com"
                                        }
                                        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                            )}

                            {/* Model Name with Dropdown */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-neutral-400">Model Name</label>
                                    <button
                                        onClick={handleFetchModels}
                                        disabled={!settings.endpoint || !settings.apiKey || loadingModels}
                                        className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <RefreshCw size={12} className={loadingModels ? "animate-spin" : ""} />
                                        {loadingModels ? "Loading..." : "Fetch Models"}
                                    </button>
                                </div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        value={settings.modelName}
                                        onChange={(e) => handleChange("modelName", e.target.value)}
                                        placeholder="gpt-4o"
                                        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors pr-10"
                                    />
                                    {models.length > 0 && (
                                        <button
                                            onClick={() => setShowModelDropdown(!showModelDropdown)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-700 rounded transition-colors"
                                        >
                                            <ChevronDown size={16} className={`text-neutral-400 transition-transform ${showModelDropdown ? "rotate-180" : ""}`} />
                                        </button>
                                    )}

                                    {/* Model Dropdown */}
                                    <AnimatePresence>
                                        {showModelDropdown && models.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute top-full left-0 right-0 mt-2 bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto shadow-xl"
                                            >
                                                {models.map((model) => (
                                                    <button
                                                        key={model}
                                                        onClick={() => handleSelectModel(model)}
                                                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-700 transition-colors ${model === settings.modelName
                                                            ? "text-emerald-400 bg-emerald-500/10"
                                                            : "text-neutral-300"
                                                            }`}
                                                    >
                                                        {model}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <p className="text-xs text-neutral-500">
                                    {models.length > 0
                                        ? `${models.length} models available - click dropdown or type manually`
                                        : "e.g., gpt-4o, gpt-3.5-turbo, deepseek-chat"
                                    }
                                </p>
                            </div>

                            {/* Test Status */}
                            {testStatus !== "idle" && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex items-center gap-2 p-3 rounded-xl ${testStatus === "testing"
                                        ? "bg-neutral-800 text-neutral-300"
                                        : testStatus === "success"
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : "bg-red-500/20 text-red-400"
                                        }`}
                                >
                                    {testStatus === "testing" && <Loader2 size={16} className="animate-spin" />}
                                    {testStatus === "success" && <CheckCircle size={16} />}
                                    {testStatus === "error" && <AlertCircle size={16} />}
                                    <span className="text-sm">{testMessage || "Testing connection..."}</span>
                                </motion.div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-neutral-800 pt-4">
                                <h3 className="text-sm font-semibold text-neutral-300 mb-3">🎤 TTS Settings</h3>

                                {/* TTS Provider Selector */}
                                <div className="space-y-2 mb-4">
                                    <label className="text-sm font-medium text-neutral-400">TTS 渠道</label>
                                    <div className="flex gap-2">
                                        {(["gemini", "microsoft"] as TTSProvider[]).map((provider) => (
                                            <button
                                                key={provider}
                                                onClick={() => handleChange("ttsProvider", provider)}
                                                className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${settings.ttsProvider === provider
                                                    ? "bg-purple-600 text-white"
                                                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                                                    }`}
                                            >
                                                {provider === "gemini" ? "Gemini TTS" : "微软 TTS"}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        {settings.ttsProvider === "gemini"
                                            ? "Google Gemini 原生 TTS，支持情感表达和多音色"
                                            : "微软 Azure Neural TTS，音质优秀，无需配置 API Key"}
                                    </p>
                                </div>

                                {/* Gemini TTS Settings */}
                                {settings.ttsProvider === "gemini" && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-4"
                                    >
                                        {settings.apiType === 'vertexai' && (
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.ttsUseVertex}
                                                    onChange={(e) => handleChange("ttsUseVertex", e.target.checked)}
                                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-neutral-800 border-neutral-700"
                                                />
                                                <span className="text-xs text-neutral-400">共用 Vertex 配置</span>
                                            </label>
                                        )}

                                        {/* TTS Endpoint */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-neutral-400">TTS Endpoint</label>
                                            <input
                                                type="text"
                                                value={settings.ttsEndpoint}
                                                onChange={(e) => handleChange("ttsEndpoint", e.target.value)}
                                                placeholder="留空使用官方 (https://generativelanguage.googleapis.com)"
                                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                                            />
                                        </div>

                                        {/* TTS API Key */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-neutral-400">TTS API Key</label>
                                            <input
                                                type="password"
                                                value={settings.ttsApiKey}
                                                onChange={(e) => handleChange("ttsApiKey", e.target.value)}
                                                placeholder="AIzaSy... (Gemini官方密钥)"
                                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                                            />
                                            <p className="text-xs text-neutral-500">留空则使用主 API Key</p>
                                        </div>

                                        {/* TTS Model */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-neutral-400">TTS Model</label>
                                            <select
                                                value={settings.ttsModel}
                                                onChange={(e) => handleChange("ttsModel", e.target.value)}
                                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors"
                                            >
                                                <option value="gemini-2.5-flash-preview-tts">Flash TTS (快速推荐)</option>
                                                <option value="gemini-2.5-pro-preview-tts">Pro TTS (高质量)</option>
                                            </select>
                                            <p className="text-xs text-neutral-500">
                                                AI 会根据角色自动选择合适的音色
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Microsoft TTS Settings */}
                                {settings.ttsProvider === "microsoft" && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-4"
                                    >
                                        {/* API Endpoint */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-neutral-400">API Endpoint</label>
                                            <input
                                                type="text"
                                                value={settings.msTtsEndpoint}
                                                onChange={(e) => handleChange("msTtsEndpoint", e.target.value)}
                                                placeholder="https://tts.cjack.top"
                                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                                            />
                                        </div>

                                        {/* Auth Token */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-neutral-400">Auth Token (可选)</label>
                                            <input
                                                type="password"
                                                value={settings.msTtsAuthKey}
                                                onChange={(e) => handleChange("msTtsAuthKey", e.target.value)}
                                                placeholder="留空使用内置 token"
                                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                                            />
                                            <p className="text-xs text-neutral-500">
                                                使用自己的上游服务时填写，留空则使用内置 token
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* TTS Test Button */}
                                <button
                                    onClick={handleTtsTest}
                                    disabled={settings.ttsProvider === 'gemini' && !settings.apiKey || ttsTestStatus === "testing"}
                                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors text-sm"
                                >
                                    {ttsTestStatus === "testing" ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Zap size={14} />
                                    )}
                                    测试 {settings.ttsProvider === 'gemini' ? 'Gemini' : '微软'} TTS
                                </button>

                                {/* TTS Test Result */}
                                {ttsTestStatus !== "idle" && (
                                    <div className={`mt-2 text-xs p-2 rounded-lg ${ttsTestStatus === "success" ? "bg-emerald-500/20 text-emerald-400" :
                                        ttsTestStatus === "error" ? "bg-red-500/20 text-red-400" :
                                            "bg-neutral-700 text-neutral-300"
                                        }`}>
                                        {ttsTestMessage}
                                    </div>
                                )}
                            </div>

                            {/* Preload Settings */}
                            <div className="space-y-3 pt-3 border-t border-neutral-800">
                                <label className="text-sm font-medium text-neutral-400">预加载设置</label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-neutral-500">提前准备节目数量</span>
                                        <span className="text-sm font-mono text-emerald-400">{settings.preloadBlockCount}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={10}
                                        value={settings.preloadBlockCount}
                                        onChange={(e) => handleChange("preloadBlockCount", parseInt(e.target.value))}
                                        className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-neutral-600">
                                        <span>1 (省内存)</span>
                                        <span className="text-emerald-500">推荐: 3</span>
                                        <span>10 (流畅)</span>
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        数值越大播放越流畅，但消耗更多内存和 API 调用
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleTest}
                                    disabled={!settings.apiKey || testStatus === "testing"}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
                                >
                                    <Zap size={18} />
                                    Test
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
                                >
                                    {saved ? <CheckCircle size={18} /> : <Save size={18} />}
                                    {saved ? "Saved!" : "Save"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
