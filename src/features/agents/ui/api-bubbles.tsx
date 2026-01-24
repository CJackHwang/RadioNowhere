"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Music, Mic2, Radio, Zap, Check, X, Loader2 } from 'lucide-react';
import { radioMonitor, ApiCallEvent } from '@/lib/radio_monitor';

interface ApiBubble extends ApiCallEvent {
    visible: boolean;
}

const SERVICE_ICONS: Record<ApiCallEvent['service'], React.ReactNode> = {
    AI: <Cpu size={12} />,
    TTS: <Mic2 size={12} />,
    Music: <Music size={12} />,
    Lyrics: <Radio size={12} />,
    Proxy: <Zap size={12} />,
};

const SERVICE_COLORS: Record<ApiCallEvent['service'], string> = {
    AI: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    TTS: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Music: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    Lyrics: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Proxy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

export default function ApiCallBubbles() {
    const [bubbles, setBubbles] = useState<ApiBubble[]>([]);

    const addOrUpdateBubble = useCallback((event: ApiCallEvent) => {
        setBubbles(prev => {
            const exists = prev.find(b => b.id === event.id);
            if (exists) {
                // 更新已有的气泡
                return prev.map(b => b.id === event.id ? { ...event, visible: true } : b);
            } else {
                // 添加新气泡
                return [...prev.slice(-9), { ...event, visible: true }]; // 最多保留 10 个
            }
        });

        // 3 秒后隐藏完成的气泡
        if (event.status !== 'pending') {
            setTimeout(() => {
                setBubbles(prev => prev.filter(b => b.id !== event.id));
            }, 3000);
        }
    }, []);

    useEffect(() => {
        const cleanup = radioMonitor.on('apiCall', addOrUpdateBubble);
        return cleanup;
    }, [addOrUpdateBubble]);

    return (
        <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-xs pointer-events-none">
            <AnimatePresence mode="popLayout">
                {bubbles.map(bubble => (
                    <motion.div
                        key={bubble.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-2xl backdrop-blur-md border ${SERVICE_COLORS[bubble.service]}`}
                    >
                        {/* 服务图标 */}
                        <div className="shrink-0">
                            {SERVICE_ICONS[bubble.service]}
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium truncate">
                                {bubble.action}
                            </div>
                            {bubble.details && (
                                <div className="text-[9px] opacity-60 truncate">
                                    {bubble.details}
                                </div>
                            )}
                        </div>

                        {/* 状态指示器 */}
                        <div className="shrink-0">
                            {bubble.status === 'pending' && (
                                <Loader2 size={12} className="animate-spin opacity-60" />
                            )}
                            {bubble.status === 'success' && (
                                <div className="flex items-center gap-1">
                                    <Check size={12} className="text-emerald-400" />
                                    {bubble.duration && (
                                        <span className="text-[9px] text-emerald-400/80">
                                            {bubble.duration > 1000
                                                ? `${(bubble.duration / 1000).toFixed(1)}s`
                                                : `${bubble.duration}ms`}
                                        </span>
                                    )}
                                </div>
                            )}
                            {bubble.status === 'error' && (
                                <X size={12} className="text-red-400" />
                            )}
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
