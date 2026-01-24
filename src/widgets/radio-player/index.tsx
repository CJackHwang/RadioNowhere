"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Pause, Radio, Disc3, MessageCircle, Send,
    Volume2, VolumeX, ChevronDown, ChevronUp, Loader2,
    Cpu, Music, Mic2,
    Layers, Zap, Clock, RotateCcw
} from 'lucide-react';
import { directorAgent } from '@features/agents/lib/director-agent';
import { audioMixer } from '@shared/services/audio-service/mixer';
import { radioMonitor, AgentStatus, ScriptEvent, LogEvent } from '@shared/services/monitor-service';
import { TimelineBlock, TalkBlock, MusicBlock, ShowTimeline, PlayerState } from '@shared/types/radio-core';
import { hasSession, getSession, clearSession } from '@shared/services/storage-service/session';
import { mailQueue } from '@features/feedback/lib/mail-queue';

// ================== Components ==================

/**
 * Agent Status Badge - 顶部 Agent 监控组件
 */
const AgentConsole = React.memo(({ statuses }: { statuses: Record<string, AgentStatus> }) => {
    const agents = useMemo(() => [
        { id: 'WRITER', icon: <Cpu size={14} />, label: 'Writer' },
        { id: 'TTS', icon: <Mic2 size={14} />, label: 'TTS' },
        { id: 'DIRECTOR', icon: <Zap size={14} />, label: 'Director' },
        { id: 'MIXER', icon: <Music size={14} />, label: 'Mixer' },
    ], []);

    return (
        <div className="flex gap-2 p-3 bg-black/40 backdrop-blur-sm border-b border-white/5 overflow-x-auto no-scrollbar">
            {agents.map(agent => (
                <div
                    key={agent.id}
                    className="flex flex-col gap-1 min-w-[70px] shrink-0"
                >
                    <div className="flex items-center gap-1.5">
                        <span className={`p-1 rounded-md transition-colors ${statuses[agent.id]?.status === 'BUSY' ? 'bg-emerald-500/20 text-emerald-400' :
                            statuses[agent.id]?.status === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                                'bg-neutral-800 text-neutral-500'
                            }`}>
                            {agent.icon}
                        </span>
                        <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">{agent.label}</span>
                    </div>
                    <div className="h-0.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${statuses[agent.id]?.status === 'BUSY' ? 'bg-emerald-500 animate-pulse-fast' :
                                statuses[agent.id]?.status === 'ERROR' ? 'bg-red-500' :
                                    'bg-neutral-800'
                                }`}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
});

AgentConsole.displayName = 'AgentConsole';

/**
 * Subtitle Display - 动态滚动字幕 (歌词样式)
 */
const SubtitleDisplay = React.memo(({ currentLine }: { currentLine: ScriptEvent | null }) => {
    const [history, setHistory] = useState<ScriptEvent[]>([]);

    useEffect(() => {
        if (currentLine) {
            setHistory(prev => {
                // 如果最后一条内容完全一样，不再重复添加
                if (prev.length > 0 && prev[prev.length - 1].text === currentLine.text) return prev;
                return [...prev.slice(-3), currentLine];
            });
        }
    }, [currentLine]);

    return (
        <div className="h-40 flex flex-col justify-end gap-3 px-6 py-4 overflow-hidden mask-fade-top relative">
            <AnimatePresence mode="popLayout" initial={false}>
                {history.map((item, i) => {
                    const isLatest = i === history.length - 1;
                    return (
                        <motion.div
                            key={item.text + i}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: isLatest ? 1 : 0.4, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="text-center"
                        >
                            <span className={`block text-[10px] mb-1 font-mono tracking-widest ${isLatest ? 'text-emerald-500/80' : 'text-neutral-600'}`}>
                                {item.speaker === 'host1' ? '阿静' : item.speaker === 'host2' ? '小北' : 'SYSTEM'}
                            </span>
                            <p className={`text-balance leading-relaxed tracking-tight transition-all duration-300 ${isLatest ? 'text-lg font-bold text-white' : 'text-sm text-neutral-500'
                                }`}>
                                {item.text}
                            </p>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
            {!currentLine && history.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-700 font-mono text-xs uppercase tracking-[0.2em]">
                    Standby for Signal...
                </div>
            )}
        </div>
    );
});

SubtitleDisplay.displayName = 'SubtitleDisplay';

// ================== Main Component ==================

export default function RadioPlayer() {
    // 状态管理
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
    const [currentScript, setCurrentScript] = useState<ScriptEvent | null>(null);
    // 扩展 TimelineBlock 支持历史标记
    type ExtendedBlock = TimelineBlock & { isHistory?: boolean; showTitle?: string };
    const [timeline, setTimeline] = useState<ExtendedBlock[]>([]);
    const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
    const [agentLogs, setAgentLogs] = useState<LogEvent[]>([]);
    const [isInitializing, setIsInitializing] = useState(false);

    // UI 交互
    const [showMailbox, setShowMailbox] = useState(false);

    const [userMessage, setUserMessage] = useState("");
    const [showTimeline, setShowTimeline] = useState(true);
    const [pendingMailCount, setPendingMailCount] = useState(0);

    // 新状态: isConnected = Agent生成中, isPlaying = 播放中
    const [isConnected, setIsConnected] = useState(false);

    // 会话恢复
    const [hasResumableSession, setHasResumableSession] = useState(false);
    const [showResumePrompt, setShowResumePrompt] = useState(false);

    const timelineScrollRef = useRef<HTMLDivElement>(null);

    // 监听逻辑
    useEffect(() => {
        const cleanupStatus = radioMonitor.on('status', (data: AgentStatus) => {
            setAgentStatuses(prev => ({ ...prev, [data.agent]: data }));
        });

        const cleanupScript = radioMonitor.on('script', (data: ScriptEvent) => {
            setCurrentScript(data);
            setCurrentBlockId(data.blockId);
        });

        const cleanupTimeline = radioMonitor.on('timeline', (data: ShowTimeline) => {
            // 保留历史：将当前 timeline 标记为历史，添加新的
            setTimeline(prev => {
                // 如果之前有 timeline，先将其标记为历史
                const prevWithHistory = prev.map(block => ({
                    ...block,
                    isHistory: true
                }));
                // 新的 timeline blocks
                const newBlocks = data.blocks.map(block => ({
                    ...block,
                    isHistory: false,
                    showTitle: data.title
                }));
                // 保留最近 3 期节目的历史
                const historyLimit = 60; // 大约 3 期节目
                const combined = [...prevWithHistory, ...newBlocks].slice(-historyLimit);
                return combined;
            });
        });

        const cleanupLogs = radioMonitor.on('log', (data: LogEvent) => {
            setAgentLogs(prev => [...prev.slice(-99), data]);
        });

        return () => {
            cleanupStatus();
            cleanupScript();
            cleanupTimeline();
            cleanupLogs();
        };
    }, []);

    // 监听邮件队列变化
    useEffect(() => {
        const cleanup = mailQueue.onMail(() => {
            setPendingMailCount(mailQueue.getStatus().pending);
        });
        return cleanup;
    }, []);

    // 自动滚动节目单
    useEffect(() => {
        if (timelineScrollRef.current && currentBlockId) {
            const activeElement = timelineScrollRef.current.querySelector(`[data-id="${currentBlockId}"]`);
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentBlockId]);

    // 检查是否有可恢复的会话
    useEffect(() => {
        if (hasSession()) {
            setHasResumableSession(true);
            setShowResumePrompt(true);
        }
    }, []);

    // ================== Controls ==================

    // Connect: 启动 Agent 生成（后台开始生成节目）
    const connect = useCallback(async () => {
        setIsInitializing(true);
        setIsConnected(true);
        setIsPlaying(true);  // 连接后自动开始播放
        setCurrentScript(null);

        try {
            await directorAgent.startShow({});
            setIsInitializing(false);
        } catch (error) {
            console.error("Failed to connect:", error);
            setIsConnected(false);
            setIsPlaying(false);
            setIsInitializing(false);
        }
    }, []);

    // Disconnect: 停止所有 Agent 生成和播放
    const disconnect = useCallback(() => {
        setIsConnected(false);
        setIsPlaying(false);
        setIsPaused(false);
        directorAgent.stopShow();
        setCurrentScript(null);
        setCurrentBlockId(null);
        setAgentStatuses({});
    }, []);

    // toggleConnection: 切换连接状态
    const toggleConnection = useCallback(() => {
        if (isConnected) {
            disconnect();
        } else {
            connect();
        }
    }, [isConnected, connect, disconnect]);

    // togglePlay: 暂停/继续播放（Agent 继续后台准备）
    const togglePlay = useCallback(() => {
        if (isPaused) {
            directorAgent.resumeShow();
            setIsPaused(false);
        } else {
            directorAgent.pauseShow();
            setIsPaused(true);
        }
    }, [isPaused]);



    const jumpToBlock = (index: number) => {
        directorAgent.skipToBlock(index);
        setCurrentBlockId(timeline[index].id);
    };

    const submitUserRequest = () => {
        if (!userMessage.trim()) return;
        mailQueue.push(userMessage);
        setPendingMailCount(mailQueue.getStatus().pending);
        setUserMessage("");
        setShowMailbox(false);
    };

    // ================== Helpers ==================

    const getBlockLabel = (block: TimelineBlock) => {
        switch (block.type) {
            case 'talk': return block.scripts[0]?.text.slice(0, 15) || 'Conversation';
            case 'music': return block.search;
            case 'music_control': return `Control: ${block.action}`;
            default: return block.type;
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto bg-[#0a0a0a] border border-white/5 rounded-[40px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] flex flex-col h-[85vh] max-h-[850px] min-h-[600px]">

            {/* 1. Agent Console */}
            <AgentConsole statuses={agentStatuses} />



            {/* 2. Main Content Area (Subtitles & Visuals) */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full" />
                    <div className="absolute bottom-[-50px] left-[-50px] w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full" />
                </div>

                {/* Subtitles */}
                <div className="flex-1 flex flex-col justify-center">
                    <SubtitleDisplay currentLine={currentScript} />
                </div>

                {/* Visualizer Visual - CSS Optimized */}
                <div className="flex items-center justify-center gap-1.5 h-12 mb-8 px-10">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-1.5 bg-emerald-500/30 rounded-full transition-all duration-300 ${isPlaying && !isPaused ? 'animate-spectrum' : 'h-1'
                                }`}
                            style={{
                                animationDelay: `${i * 0.05}s`,
                                animationDuration: `${0.6 + (i % 3) * 0.2}s`
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* 3. Sliding Timeline (Bottom-up) */}
            <AnimatePresence>
                {showTimeline && timeline.length > 0 && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 220 }}
                        exit={{ height: 0 }}
                        className="bg-black/40 backdrop-blur-xl border-t border-white/5 overflow-hidden flex flex-col"
                    >
                        <div className="px-4 py-2 flex items-center justify-between border-b border-white/5">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Clock size={10} /> Program Schedule
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setTimeline(prev => prev.filter(b => !b.isHistory))}
                                    className="text-[9px] text-neutral-600 hover:text-red-400 transition-colors px-2 py-0.5 rounded border border-neutral-800 hover:border-red-900"
                                >
                                    Clear History
                                </button>
                                <button onClick={() => setShowTimeline(false)} className="text-neutral-500 hover:text-white transition-colors">
                                    <ChevronDown size={14} />
                                </button>
                            </div>
                        </div>
                        <div
                            ref={timelineScrollRef}
                            className="flex-1 overflow-y-auto no-scrollbar px-4 py-2 space-y-1.5"
                        >
                            {timeline.map((block, i) => {
                                const isActive = block.id === currentBlockId;
                                const isHistory = block.isHistory;
                                return (
                                    <motion.button
                                        key={`${block.id}-${i}`}
                                        data-id={block.id}
                                        onClick={() => !isHistory && jumpToBlock(i)}
                                        disabled={isHistory}
                                        className={`w-full text-left px-4 py-3 rounded-2xl transition-all duration-300 flex items-center gap-4 ${isActive
                                            ? 'bg-emerald-500/10 border border-emerald-500/30 ring-1 ring-emerald-500/10'
                                            : isHistory
                                                ? 'opacity-20 border border-transparent cursor-default'
                                                : 'hover:bg-white/5 border border-transparent opacity-40 hover:opacity-100'
                                            }`}
                                    >
                                        <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-500 text-black' :
                                            isHistory ? 'bg-neutral-900/50 text-neutral-700' :
                                                'bg-neutral-900 text-neutral-600'
                                            }`}>
                                            {block.type === 'talk' ? <Mic2 size={14} /> : block.type === 'music' ? <Music size={14} /> : <Zap size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : isHistory ? 'text-neutral-600' : 'text-neutral-300'}`}>
                                                {getBlockLabel(block)}
                                            </div>
                                            <div className="text-[10px] text-neutral-600 uppercase font-mono mt-0.5">
                                                {block.type} • {isActive ? 'NOW AIRING' : isHistory ? 'PLAYED' : 'PENDING'}
                                            </div>
                                        </div>
                                        {isActive && (
                                            <motion.div
                                                layoutId="active-indicator"
                                                className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
                                            />
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 4. Controls Footer */}
            <div className="bg-[#0f0f0f] border-t border-white/5 p-6 backdrop-blur-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-4">
                    {/* Main Connect Toggle */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleConnection}
                        className={`group relative overflow-hidden px-8 py-3.5 rounded-2xl flex items-center gap-3 transition-all duration-500 ${isConnected
                            ? 'bg-black border border-red-900/40 text-red-500 shadow-[0_0_20px_rgba(153,27,27,0.1)]'
                            : 'bg-emerald-500 text-black font-black uppercase tracking-wider'
                            }`}
                    >
                        {isInitializing ? <Loader2 className="animate-spin" size={18} /> :
                            isConnected ? <Pause className="fill-current" size={18} /> : <Play className="fill-current" size={18} />}
                        <span className="font-bold text-sm">{isConnected ? 'Disconnect' : 'Connect Now'}</span>
                    </motion.button>

                    <div className="flex-1 flex items-center justify-around">
                        <PlayerActionBtn onClick={togglePlay} active={isPaused} icon={isPaused ? <Play size={20} /> : <Pause size={20} />} label="Flow" disabled={!isConnected} />
                        <PlayerActionBtn onClick={() => setShowTimeline(!showTimeline)} active={showTimeline} icon={<Layers size={20} />} label="List" />
                        <div className="relative">
                            <PlayerActionBtn onClick={() => setShowMailbox(true)} icon={<MessageCircle size={20} />} label="Mail" />
                            {pendingMailCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {pendingMailCount}
                                </span>
                            )}
                        </div>
                        <PlayerActionBtn onClick={() => {
                            setIsMuted(!isMuted);
                            audioMixer.setMasterVolume(!isMuted ? 0 : 0.8);
                        }} active={isMuted} icon={isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />} label="Audio" />
                    </div>
                </div>

                {/* Mailbox Drawer */}
                <AnimatePresence>
                    {showMailbox && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="mt-6 flex gap-3 p-2 bg-neutral-900/50 rounded-2xl border border-white/5"
                        >
                            <input
                                value={userMessage}
                                onChange={e => setUserMessage(e.target.value)}
                                placeholder="Whisper something to Nowhere..."
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-3 text-white placeholder-neutral-600"
                                onKeyDown={e => e.key === 'Enter' && submitUserRequest()}
                            />
                            <button
                                onClick={submitUserRequest}
                                className="p-2 bg-emerald-500 rounded-xl text-black hover:bg-emerald-400 transition-colors"
                            >
                                <Send size={16} />
                            </button>
                            <button onClick={() => setShowMailbox(false)} className="px-3 text-neutral-500 text-xs">Cancel</button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style jsx global>{`
                .mask-fade-top {
                    mask-image: linear-gradient(to bottom, transparent, black 40%);
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                @keyframes spectrum {
                    0%, 100% { height: 8px; background-color: rgba(16,185,129,0.2); }
                    50% { height: 32px; background-color: rgba(16,185,129,0.7); }
                }
                .animate-spectrum {
                    animation: spectrum infinite ease-in-out;
                }
                @keyframes pulse-fast {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                .animate-pulse-fast {
                    animation: pulse-fast 1s infinite;
                }
            `}</style>
        </div>
    );
}

function PlayerActionBtn({ icon, label, onClick, active = false, disabled = false }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex flex-col items-center gap-1 group transition-all ${disabled ? 'opacity-30 cursor-not-allowed' : ''} ${active ? 'text-emerald-500' : 'text-neutral-600 hover:text-neutral-400'}`}
        >
            <div className={`p-2 rounded-xl transition-all ${active ? 'bg-emerald-500/10' : 'group-hover:bg-white/5'}`}>
                {icon}
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
        </button>
    );
}
