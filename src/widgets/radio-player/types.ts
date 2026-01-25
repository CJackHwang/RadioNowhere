import { TimelineBlock, PlayerState } from '@shared/types/radio-core';
import { AgentStatus, ScriptEvent, LogEvent } from '@shared/services/monitor-service';

// Extended TimelineBlock with history marker
export type ExtendedBlock = TimelineBlock & {
    isHistory?: boolean;
    showTitle?: string;
};

export interface RadioPlayerState {
    isPlaying: boolean;
    isConnected: boolean;
    isInitializing: boolean;
    isMuted: boolean;
    agentStatuses: Record<string, AgentStatus>;
    currentScript: ScriptEvent | null;
    timeline: ExtendedBlock[];
    currentBlockId: string | null;
    agentLogs: LogEvent[];
    showMailbox: boolean;
    userMessage: string;
    showTimeline: boolean;
    pendingMailCount: number;
}

export interface RadioPlayerActions {
    togglePlayback: () => Promise<void>;
    disconnect: () => void;
    jumpToBlock: (index: number) => void;
    submitUserRequest: () => void;
    setShowMailbox: (show: boolean) => void;
    setShowTimeline: (show: boolean) => void;
    setUserMessage: (message: string) => void;
    setIsMuted: (muted: boolean) => void;
    clearHistory: () => void;
}
