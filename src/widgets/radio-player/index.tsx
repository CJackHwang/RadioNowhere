"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
    Play, Pause, MessageCircle,
    Volume2, VolumeX, Layers, Loader2, RotateCcw,
} from 'lucide-react';

import { useRadioPlayer } from './hooks/useRadioPlayer';
import {
    AgentConsole,
    SubtitleDisplay,
    PlayerActionBtn,
    TimelinePanel,
    MailboxDrawer,
} from './ui';

export default function RadioPlayer() {
    const {
        // State
        isPlaying,
        isConnected,
        isInitializing,
        isMuted,
        agentStatuses,
        agentLogs,
        currentScript,
        timeline,
        currentBlockId,
        showMailbox,
        userMessage,
        showTimeline,
        pendingMailCount,
        // Actions
        togglePlayback,
        disconnect,
        jumpToBlock,
        submitUserRequest,
        setShowMailbox,
        setShowTimeline,
        setUserMessage,
        setIsMuted,
        clearHistory,
        // Refs
        timelineScrollRef,
    } = useRadioPlayer();

    // Use a flexible container instead of flexible aspect ratio
    const [isSubtitleExpanded, setIsSubtitleExpanded] = React.useState(false);

    return (
        <div className="relative w-full max-w-[400px] mx-auto flex flex-col my-4 md:my-0 min-h-[400px] h-auto transition-all duration-500">

            {/* Main Card Container */}
            <div className="w-full relative min-h-[380px] glass-panel rounded-[24px] overflow-hidden flex flex-col shadow-2xl">

                {/* 1. Top Bar / Dynamic Island - REMOVED */}
                {/* <div className="absolute top-6 left-0 right-0 z-30 flex justify-center">
                    <AgentConsole statuses={agentStatuses} />
                </div> */}

                {/* 2. Main Content (Lyrics & Visuals) */}
                <div className="flex flex-col relative overflow-hidden bg-black/20">

                    {/* Animated Mesh Background - Static Fallback */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
                        {/* Static Gradient Mesh */}
                        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-violet-600/20 blur-[80px]" />
                        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-orange-500/10 blur-[80px]" />
                    </div>

                    {/* Subtitles Area (Lyrics View) */}
                    <motion.div
                        layout
                        className={`flex flex-col relative z-10 w-full max-w-md mx-auto transition-all duration-500 ${isSubtitleExpanded ? 'pt-8 pb-4' : 'pt-12 pb-12'
                            }`}
                    >
                        <SubtitleDisplay
                            currentLine={currentScript}
                            isExpanded={isSubtitleExpanded}
                            onExpandChange={setIsSubtitleExpanded}
                        />
                    </motion.div>

                </div>

                {/* 3. Controls Area (Floating Card Style) */}
                <motion.div
                    initial={false}
                    animate={{
                        height: isSubtitleExpanded ? 0 : 'auto',
                        opacity: isSubtitleExpanded ? 0 : 1,
                        translateY: isSubtitleExpanded ? 20 : 0
                    }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className="relative z-20 px-6 bg-linear-to-b from-transparent to-black/80"
                    style={{ paddingBottom: isSubtitleExpanded ? 0 : 36, paddingTop: isSubtitleExpanded ? 0 : 8 }}
                >



                    {/* Main Controls */}
                    <div className="flex flex-col gap-5">

                        {/* Play/Pause Button (Compact) */}
                        <div className="flex justify-center">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                whileHover={{ scale: 1.05 }}
                                onClick={togglePlayback}
                                className="w-16 h-16 rounded-full bg-linear-to-tr from-orange-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all duration-300 group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                {isPlaying ? (
                                    <Pause size={28} className="fill-current relative z-10" />
                                ) : (
                                    <Play size={28} className="fill-current ml-1 relative z-10" />
                                )}
                            </motion.button>
                        </div>

                        {/* Secondary Actions Row */}
                        <div className="flex items-center justify-between px-2 pb-2">
                            <PlayerActionBtn
                                onClick={() => setShowTimeline(!showTimeline)}
                                active={showTimeline}
                                icon={<Layers size={20} />}
                                label="Queue"
                            />

                            <div className="relative">
                                <PlayerActionBtn
                                    onClick={() => setShowMailbox(true)}
                                    icon={<MessageCircle size={20} />}
                                    label="Chat"
                                />
                                {pendingMailCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-black">
                                        {pendingMailCount}
                                    </span>
                                )}
                            </div>

                            <PlayerActionBtn
                                onClick={() => setIsMuted(!isMuted)}
                                active={isMuted}
                                icon={isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                label="Sound"
                            />

                            {isConnected && (
                                <PlayerActionBtn
                                    onClick={disconnect}
                                    icon={<RotateCcw size={20} />}
                                    label="Reset"
                                />
                            )}
                        </div>
                    </div>
                </motion.div>

            </div>

            {/* Side Drawers */}
            <TimelinePanel
                timeline={timeline}
                currentBlockId={currentBlockId}
                showTimeline={showTimeline}
                onClose={() => setShowTimeline(false)}
                onJumpToBlock={jumpToBlock}
                onClearHistory={clearHistory}
                timelineScrollRef={timelineScrollRef}
            />

            <MailboxDrawer
                showMailbox={showMailbox}
                userMessage={userMessage}
                onUserMessageChange={setUserMessage}
                onSubmit={submitUserRequest}
                onClose={() => setShowMailbox(false)}
            />
        </div >
    );
}
