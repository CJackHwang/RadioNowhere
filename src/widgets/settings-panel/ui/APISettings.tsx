"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RefreshCw, ChevronDown, Loader2, CheckCircle } from 'lucide-react';
import { IApiSettings, ApiType } from '@shared/services/storage-service/settings';
import { TestStatus } from '../types';

interface APISettingsProps {
    settings: IApiSettings;
    testStatus: TestStatus;
    testMessage: string;
    models: string[];
    loadingModels: boolean;
    showModelDropdown: boolean;
    onSettingChange: (field: keyof IApiSettings, value: string | boolean | number) => void;
    onFetchModels: () => void;
    onSelectModel: (model: string) => void;
    onToggleDropdown: (show: boolean) => void;
}

export default function APISettings({
    settings,
    testStatus,
    testMessage,
    models,
    loadingModels,
    showModelDropdown,
    onSettingChange,
    onFetchModels,
    onSelectModel,
    onToggleDropdown,
}: APISettingsProps) {
    return (
        <div className="space-y-5">
            {/* API Type Selector */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400">API Type</label>
                <div className="flex gap-2">
                    {(["openai", "gemini", "vertexai"] as ApiType[]).map((type) => (
                        <button
                            key={type}
                            onClick={() => onSettingChange("apiType", type)}
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

            {/* API Key / Access Token */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400">
                    {settings.apiType === 'vertexai' ? "Access Token" : "API Key"}
                </label>
                <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => onSettingChange("apiKey", e.target.value)}
                    placeholder={settings.apiType === 'vertexai' ? "ya29.a0AfH6S..." : "sk-..."}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
            </div>

            {/* Vertex AI Specific */}
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
                            onChange={(e) => onSettingChange("gcpProject", e.target.value)}
                            placeholder="my-project-id"
                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-400">GCP Location</label>
                        <input
                            type="text"
                            value={settings.gcpLocation}
                            onChange={(e) => onSettingChange("gcpLocation", e.target.value)}
                            placeholder="us-central1"
                            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                    </div>
                </motion.div>
            )}

            {/* Endpoint (non-Vertex) */}
            {settings.apiType !== "vertexai" && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-400">API Endpoint</label>
                    <input
                        type="text"
                        value={settings.endpoint}
                        onChange={(e) => onSettingChange("endpoint", e.target.value)}
                        placeholder={settings.apiType === "openai" ? "https://api.openai.com" : "https://generativelanguage.googleapis.com"}
                        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                </div>
            )}

            {/* Model Name with Dropdown */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-400">Model Name</label>
                    <button
                        onClick={onFetchModels}
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
                        onChange={(e) => onSettingChange("modelName", e.target.value)}
                        placeholder="gpt-4o"
                        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors pr-10"
                    />
                    {models.length > 0 && (
                        <button
                            onClick={() => onToggleDropdown(!showModelDropdown)}
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
                                        onClick={() => onSelectModel(model)}
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
                        : "e.g., gpt-4o, gpt-3.5-turbo, deepseek-chat"}
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
        </div>
    );
}
