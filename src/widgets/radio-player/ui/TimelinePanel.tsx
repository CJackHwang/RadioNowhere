"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, Mic2, Music, Zap, X } from 'lucide-react';
import { TimelineBlock } from '@shared/types/radio-core';
import { ExtendedBlock } from '../types';

interface TimelinePanelProps {
    timeline: ExtendedBlock[];
    currentBlockId: string | null;
    showTimeline: boolean;
    onClose: () => void;
    onJumpToBlock: (index: number) => void;
    onClearHistory: () => void;
    timelineScrollRef: React.RefObject<HTMLDivElement | null>;
}

function getBlockLabel(block: TimelineBlock): string {
    switch (block.type) {
        case 'talk': return block.scripts[0]?.text.slice(0, 15) || 'Conversation';
        case 'music': return block.search;
        case 'music_control': return `Control: ${block.action}`;
        default: return block.type;
    }
}

export default function TimelinePanel({
    timeline,
    currentBlockId,
    showTimeline,
    onClose,
    onJumpToBlock,
    onClearHistory,
    timelineScrollRef,
}: TimelinePanelProps) {
    return (
        <AnimatePresence>
            {showTimeline && timeline.length > 0 && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 rounded-[32px]"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="absolute inset-x-4 bottom-4 top-16 z-50 glass-panel rounded-3xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-black/30">
                            <span className="text-xs font-bold text-neutral-300 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={12} className="text-violet-400" />
                                Program Queue
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onClearHistory}
                                    className="text-[10px] text-neutral-500 hover:text-red-400 transition-colors px-2.5 py-1 rounded-lg bg-white/5 hover:bg-red-500/10"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-all"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div
                            ref={timelineScrollRef}
                            className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2"
                        >
                            {timeline.map((block, i) => {
                                const isActive = block.id === currentBlockId && !block.isHistory;
                                const isHistory = block.isHistory;
                                return (
                                    <motion.button
                                        key={`${block.id}-${i}`}
                                        data-id={block.id}
                                        onClick={() => !isHistory && onJumpToBlock(i)}
                                        disabled={isHistory}
                                        whileHover={!isHistory ? { scale: 1.01 } : {}}
                                        whileTap={!isHistory ? { scale: 0.99 } : {}}
                                        className={`w-full text-left px-4 py-3 rounded-2xl transition-all duration-200 flex items-center gap-3 ${isHistory ? 'cursor-not-allowed' : 'cursor-pointer'
                                            } ${isActive
                                                ? 'bg-linear-to-r from-violet-500/20 to-pink-500/20 border border-violet-500/30 shadow-lg shadow-violet-500/10'
                                                : isHistory
                                                    ? 'opacity-30 border border-transparent'
                                                    : 'hover:bg-white/5 border border-transparent opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isActive
                                            ? 'bg-linear-to-br from-violet-500 to-pink-500 text-white shadow-lg'
                                            : isHistory
                                                ? 'bg-neutral-900/50 text-neutral-700'
                                                : 'bg-neutral-800 text-neutral-500'
                                            }`}>
                                            {block.type === 'talk' ? <Mic2 size={16} /> : block.type === 'music' ? <Music size={16} /> : <Zap size={16} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-medium truncate ${isActive ? 'text-white' : isHistory ? 'text-neutral-600' : 'text-neutral-300'
                                                }`}>
                                                {getBlockLabel(block)}
                                            </div>
                                            <div className="text-[10px] text-neutral-500 uppercase font-mono mt-0.5 flex items-center gap-2">
                                                <span>{block.type === 'talk' ? '💬' : block.type === 'music' ? '🎵' : '⚡'}</span>
                                                {isActive ? 'NOW PLAYING' : isHistory ? 'PLAYED' : 'UP NEXT'}
                                            </div>
                                        </div>
                                        {isActive && (
                                            <div className="w-2 h-2 rounded-full bg-linear-to-r from-violet-400 to-pink-400 animate-pulse shadow-lg shadow-violet-500/50" />
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

