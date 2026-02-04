"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2 } from 'lucide-react';
import { IApiSettings, TTSProvider } from '@shared/services/storage-service/settings';
import { TestStatus } from '../types';

interface TTSSettingsProps {
    settings: IApiSettings;
    ttsTestStatus: TestStatus;
    ttsTestMessage: string;
    onSettingChange: (field: keyof IApiSettings, value: string | boolean | number) => void;
    onTtsTest: () => Promise<void>;
}

export default function TTSSettings({
    settings,
    ttsTestStatus,
    ttsTestMessage,
    onSettingChange,
    onTtsTest,
}: TTSSettingsProps) {
    const isGeminiTts = settings.ttsProvider === 'gemini';
    const useVertex = isGeminiTts && settings.ttsUseVertex && settings.apiType === 'vertexai';
    const hasDirectKey = Boolean(settings.ttsApiKey || settings.apiKey);
    const hasVertexConfig = Boolean(settings.apiKey && settings.gcpProject && settings.gcpLocation);
    const isTtsTestDisabled = ttsTestStatus === "testing" || (isGeminiTts && (useVertex ? !hasVertexConfig : !hasDirectKey));
    return (
        <div className="border-t border-neutral-800 pt-4">
            <h3 className="text-sm font-semibold text-neutral-300 mb-3">🎤 TTS Settings</h3>

            {/* TTS Provider Selector */}
            <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-neutral-400">TTS 渠道</label>
                <div className="flex gap-2">
                    {(["gemini", "microsoft"] as TTSProvider[]).map((provider) => (
                        <button
                            key={provider}
                            onClick={() => onSettingChange("ttsProvider", provider)}
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
                                onChange={(e) => onSettingChange("ttsUseVertex", e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-neutral-800 border-neutral-700"
                            />
                            <span className="text-xs text-neutral-400">共用 Vertex 配置</span>
                        </label>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-400">TTS Endpoint</label>
                        <input
                            type="text"
                            value={settings.ttsEndpoint}
                            onChange={(e) => onSettingChange("ttsEndpoint", e.target.value)}
                            placeholder="留空使用官方 (https://generativelanguage.googleapis.com)"
                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-400">TTS API Key</label>
                        <input
                            type="password"
                            value={settings.ttsApiKey}
                            onChange={(e) => onSettingChange("ttsApiKey", e.target.value)}
                            placeholder="AIzaSy... (Gemini官方密钥)"
                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <p className="text-xs text-neutral-500">留空则使用主 API Key</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-400">TTS Model</label>
                        <select
                            value={settings.ttsModel}
                            onChange={(e) => onSettingChange("ttsModel", e.target.value)}
                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors"
                        >
                            <option value="gemini-2.5-flash-preview-tts">Flash TTS (快速推荐)</option>
                            <option value="gemini-2.5-pro-preview-tts">Pro TTS (高质量)</option>
                        </select>
                        <p className="text-xs text-neutral-500">AI 会根据角色自动选择合适的音色</p>
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
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-400">API Endpoint</label>
                        <input
                            type="text"
                            value={settings.msTtsEndpoint}
                            onChange={(e) => onSettingChange("msTtsEndpoint", e.target.value)}
                            placeholder="https://tts.cjack.top"
                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-400">Auth Token (可选)</label>
                        <input
                            type="password"
                            value={settings.msTtsAuthKey}
                            onChange={(e) => onSettingChange("msTtsAuthKey", e.target.value)}
                            placeholder="留空使用内置 token"
                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                        <p className="text-xs text-neutral-500">使用自己的上游服务时填写，留空则使用内置 token</p>
                    </div>
                </motion.div>
            )}

            {/* TTS Test Button */}
            <button
                onClick={onTtsTest}
                disabled={isTtsTestDisabled}
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
    );
}
