"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Zap, CheckCircle, Loader2 } from "lucide-react";

import { useSettingsPanel } from "./hooks/useSettingsPanel";
import { APISettings, TTSSettings, PreloadSettings } from "./ui";

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const {
        settings,
        testStatus,
        testMessage,
        saved,
        models,
        loadingModels,
        showModelDropdown,
        ttsTestStatus,
        ttsTestMessage,
        handleChange,
        handleSave,
        handleTest,
        handleFetchModels,
        handleTtsTest,
        handleSelectModel,
        setShowModelDropdown,
    } = useSettingsPanel(isOpen);

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
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-neutral-900 border border-neutral-700 rounded-2xl z-[110] overflow-hidden shadow-2xl max-h-[85vh] overflow-y-auto"
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
                            {/* API Settings */}
                            <APISettings
                                settings={settings}
                                testStatus={testStatus}
                                testMessage={testMessage}
                                models={models}
                                loadingModels={loadingModels}
                                showModelDropdown={showModelDropdown}
                                onSettingChange={handleChange}
                                onFetchModels={handleFetchModels}
                                onSelectModel={handleSelectModel}
                                onToggleDropdown={setShowModelDropdown}
                            />

                            {/* TTS Settings */}
                            <TTSSettings
                                settings={settings}
                                ttsTestStatus={ttsTestStatus}
                                ttsTestMessage={ttsTestMessage}
                                onSettingChange={handleChange}
                                onTtsTest={handleTtsTest}
                            />

                            {/* Preload Settings */}
                            <PreloadSettings
                                settings={settings}
                                onSettingChange={handleChange}
                            />

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleTest}
                                    disabled={!settings.apiKey || testStatus === "testing"}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
                                >
                                    {testStatus === "testing" ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
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
