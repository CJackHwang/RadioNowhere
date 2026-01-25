"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { directorAgent } from '@features/agents/lib/director-agent';
import { audioMixer } from '@shared/services/audio-service/mixer';
import { radioMonitor, AgentStatus, ScriptEvent, LogEvent } from '@shared/services/monitor-service';
import { ShowTimeline } from '@shared/types/radio-core';
import { mailQueue } from '@features/feedback/lib/mail-queue';
import { ExtendedBlock, RadioPlayerState, RadioPlayerActions } from '../types';

export function useRadioPlayer(): RadioPlayerState & RadioPlayerActions & {
    timelineScrollRef: React.RefObject<HTMLDivElement | null>;
} {
    // 状态管理
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
    const [currentScript, setCurrentScript] = useState<ScriptEvent | null>(null);
    const [timeline, setTimeline] = useState<ExtendedBlock[]>([]);
    const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
    const [agentLogs, setAgentLogs] = useState<LogEvent[]>([]);
    const [isInitializing, setIsInitializing] = useState(false);

    // UI 交互
    const [showMailbox, setShowMailbox] = useState(false);
    const [userMessage, setUserMessage] = useState("");
    const [showTimeline, setShowTimeline] = useState(true);
    const [pendingMailCount, setPendingMailCount] = useState(0);

    // 连接状态
    const [isConnected, setIsConnected] = useState(false);

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
            setTimeline(prev => {
                const prevWithHistory = prev.map(block => ({
                    ...block,
                    isHistory: true
                }));
                const newBlocks = data.blocks.map(block => ({
                    ...block,
                    isHistory: false,
                    showTitle: data.title
                }));
                const historyLimit = 60;
                const combined = [...prevWithHistory, ...newBlocks].slice(-historyLimit);
                return combined;
            });
            // Reset currentBlockId when new timeline arrives to prevent ID conflicts
            // The correct block ID will be set by the next 'script' event
            setCurrentBlockId(null);
        });

        const cleanupLogs = radioMonitor.on('log', (data: LogEvent) => {
            setAgentLogs(prev => [...prev.slice(-199), data]);
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

    // 统一播放控制
    const togglePlayback = useCallback(async () => {
        if (isPlaying) {
            directorAgent.pauseShow();
            setIsPlaying(false);
            setIsInitializing(false);
        } else {
            if (!isConnected) {
                setIsInitializing(true);
                setIsConnected(true);
                setIsPlaying(true);
                setCurrentScript(null);
                try {
                    // Safety timeout: force stop initializing after 3s if agent hangs
                    setTimeout(() => setIsInitializing(false), 3000);
                    await directorAgent.startShow({});
                } catch (error) {
                    console.error("Failed to start:", error);
                    setIsConnected(false);
                    setIsPlaying(false);
                }
                setIsInitializing(false);
            } else {
                directorAgent.resumeShow();
                setIsPlaying(true);
            }
        }
    }, [isPlaying, isConnected]);

    // 断开连接
    const disconnect = useCallback(() => {
        setIsConnected(false);
        setIsPlaying(false);
        directorAgent.stopShow();
        setCurrentScript(null);
        setCurrentBlockId(null);
        setAgentStatuses({});
    }, []);

    const jumpToBlock = useCallback((uiIndex: number) => {
        const targetBlock = timeline[uiIndex];

        // Validate target block exists
        if (!targetBlock) {
            console.warn('[jumpToBlock] Invalid index:', uiIndex);
            return;
        }

        // History blocks cannot be jumped to (audio data is cleared)
        if (targetBlock.isHistory) {
            console.warn('[jumpToBlock] Cannot jump to history block - audio not available');
            return;
        }

        // Calculate actual index in current timeline (excluding history blocks)
        const currentBlocks = timeline.filter(b => !b.isHistory);
        const actualIndex = currentBlocks.findIndex(b => b.id === targetBlock.id);

        if (actualIndex >= 0) {
            console.log(`[jumpToBlock] UI index: ${uiIndex} -> Actual index: ${actualIndex}, block: ${targetBlock.id}`);
            directorAgent.skipToBlock(actualIndex);
        } else {
            console.warn('[jumpToBlock] Block not found in current timeline:', targetBlock.id);
        }
    }, [timeline]);

    const submitUserRequest = useCallback(() => {
        if (!userMessage.trim()) return;
        mailQueue.push(userMessage);
        setPendingMailCount(mailQueue.getStatus().pending);
        setUserMessage("");
        setShowMailbox(false);
    }, [userMessage]);

    const clearHistory = useCallback(() => {
        setTimeline(prev => prev.filter(b => !b.isHistory));
    }, []);

    const handleSetIsMuted = useCallback((muted: boolean) => {
        setIsMuted(muted);
        audioMixer.setMasterVolume(muted ? 0 : 0.8);
    }, []);

    return {
        // State
        isPlaying,
        isConnected,
        isInitializing,
        isMuted,
        agentStatuses,
        currentScript,
        timeline,
        currentBlockId,
        agentLogs,
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
        setIsMuted: handleSetIsMuted,
        clearHistory,
        // Refs
        timelineScrollRef,
    };
}
