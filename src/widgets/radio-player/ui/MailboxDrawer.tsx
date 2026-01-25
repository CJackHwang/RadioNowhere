"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Sparkles } from 'lucide-react';

interface MailboxDrawerProps {
    showMailbox: boolean;
    userMessage: string;
    onUserMessageChange: (message: string) => void;
    onSubmit: () => void;
    onClose: () => void;
}

export default function MailboxDrawer({
    showMailbox,
    userMessage,
    onUserMessageChange,
    onSubmit,
    onClose,
}: MailboxDrawerProps) {
    const handleSubmit = () => {
        if (userMessage.trim()) {
            onSubmit();
        }
    };

    return (
        <AnimatePresence>
            {showMailbox && (
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="mt-6 w-full max-w-md mx-auto"
                >
                    {/* Outer glow wrapper */}
                    <div className="relative group">
                        {/* Gradient glow effect */}
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600/30 via-pink-500/30 to-orange-500/30 rounded-2xl blur-lg opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

                        {/* Main container */}
                        <div className="relative glass-panel rounded-2xl p-1.5 overflow-hidden">
                            {/* Inner gradient border */}
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none" />

                            {/* Input row */}
                            <div className="relative flex items-center gap-2">
                                {/* Sparkle icon */}
                                <div className="pl-3 text-violet-400/60">
                                    <Sparkles size={16} />
                                </div>

                                {/* Text input */}
                                <input
                                    value={userMessage}
                                    onChange={e => onUserMessageChange(e.target.value)}
                                    placeholder="Whisper to Nowhere..."
                                    className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm py-3 px-2 text-white/90 placeholder-neutral-500 font-light tracking-wide"
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    autoFocus
                                />

                                {/* Action buttons */}
                                <div className="flex items-center gap-1.5 pr-1.5">
                                    {/* Send button */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleSubmit}
                                        disabled={!userMessage.trim()}
                                        className={`p-2.5 rounded-xl transition-all duration-300 ${userMessage.trim()
                                            ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40'
                                            : 'bg-white/5 text-neutral-600 cursor-not-allowed'
                                            }`}
                                    >
                                        <Send size={14} />
                                    </motion.button>

                                    {/* Close button */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={onClose}
                                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all duration-200"
                                    >
                                        <X size={14} />
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hint text */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-center text-[10px] text-neutral-600 mt-3 font-mono tracking-wider"
                    >
                        Press Enter to transmit • Messages may influence the broadcast
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
