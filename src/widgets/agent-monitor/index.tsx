"use client";

import { useState, useEffect } from "react";
import { Bot, ChevronDown, ChevronUp, X, Wrench, Brain, MessageSquare, AlertCircle, CheckCircle, Loader2, Trash2 } from "lucide-react";
import { radioMonitor, AgentStatus, LogEvent, AgentType, AgentThought } from "@shared/services/monitor-service";
import { resetHistory } from "@features/history-tracking/lib/history-manager";

interface AgentState {
    status: AgentStatus['status'];
    message?: string;
}

export default function AgentMonitor() {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeTab, setActiveTab] = useState<'thoughts' | 'logs'>('thoughts');
    const [agents, setAgents] = useState<Record<AgentType, AgentState>>({
        WRITER: { status: 'IDLE' },
        DIRECTOR: { status: 'IDLE' },
        TTS: { status: 'IDLE' },
        MIXER: { status: 'IDLE' }
    });
    const [logs, setLogs] = useState<LogEvent[]>([]);
    const [thoughts, setThoughts] = useState<AgentThought[]>([]);

    // 订阅事件
    useEffect(() => {
        const unsubStatus = radioMonitor.on('status', (data) => {
            setAgents(prev => ({
                ...prev,
                [data.agent]: { status: data.status, message: data.message }
            }));
        });

        const unsubLog = radioMonitor.on('log', (data) => {
            setLogs(prev => [...prev.slice(-29), data]);
        });

        const unsubThought = radioMonitor.on('thought', (data) => {
            setThoughts(prev => [...prev.slice(-19), data]);
        });

        return () => {
            unsubStatus();
            unsubLog();
            unsubThought();
        };
    }, []);

    const handleClearMemory = () => {
        if (confirm('清除 AI 记忆？这将允许 AI 重复之前的节目类型和歌曲。')) {
            resetHistory();
            radioMonitor.log('MIXER', 'AI memory cleared by user', 'info');
        }
    };

    const getStatusIcon = (status: AgentStatus['status']) => {
        switch (status) {
            case 'BUSY': return <Loader2 className="w-3 h-3 animate-spin text-blue-400" />;
            case 'ERROR': return <AlertCircle className="w-3 h-3 text-red-400" />;
            case 'READY': return <CheckCircle className="w-3 h-3 text-green-400" />;
            default: return <div className="w-2 h-2 rounded-full bg-neutral-500" />;
        }
    };

    const getStatusColor = (status: AgentStatus['status']) => {
        switch (status) {
            case 'BUSY': return 'text-blue-400';
            case 'ERROR': return 'text-red-400';
            case 'READY': return 'text-green-400';
            default: return 'text-neutral-500';
        }
    };

    const getThoughtIcon = (type: AgentThought['type']) => {
        switch (type) {
            case 'output': return <Brain className="w-3 h-3 text-purple-400 shrink-0" />;
            case 'tool_call': return <Wrench className="w-3 h-3 text-blue-400 shrink-0" />;
            case 'tool_result': return <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />;
            default: return <MessageSquare className="w-3 h-3 text-neutral-400 shrink-0" />;
        }
    };

    const getThoughtLabel = (type: AgentThought['type'], toolName?: string) => {
        switch (type) {
            case 'output': return 'AI Output';
            case 'tool_call': return `Tool: ${toolName}`;
            case 'tool_result': return `Result: ${toolName}`;
            default: return 'Thinking';
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 z-50 p-2.5 bg-neutral-800/90 hover:bg-neutral-700 rounded-full transition-all backdrop-blur-sm border border-neutral-700 group"
                title="Agent Monitor"
            >
                <Bot size={18} className="text-neutral-400 group-hover:text-white transition-colors" />
                {(agents.WRITER.status === 'BUSY' || agents.DIRECTOR.status === 'BUSY') && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                )}
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 z-50 w-96 max-h-[80vh] bg-neutral-900/95 backdrop-blur-md rounded-lg border border-neutral-700 shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-700 bg-neutral-800/50">
                <div className="flex items-center gap-2">
                    <Bot size={16} className="text-neutral-400" />
                    <span className="text-xs font-semibold text-neutral-300">Agent Monitor</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleClearMemory}
                        className="p-1 hover:bg-red-900/30 rounded transition-colors group"
                        title="Clear AI Memory"
                    >
                        <Trash2 size={14} className="text-neutral-500 group-hover:text-red-400" />
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 hover:bg-neutral-700 rounded transition-colors"
                    >
                        {isExpanded ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronUp size={14} className="text-neutral-400" />}
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 hover:bg-neutral-700 rounded transition-colors"
                    >
                        <X size={14} className="text-neutral-400" />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <>
                    {/* Agents Status */}
                    <div className="px-3 py-2 border-b border-neutral-800 space-y-1.5">
                        {(['WRITER', 'DIRECTOR', 'TTS'] as AgentType[]).map(agent => (
                            <div key={agent} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(agents[agent].status)}
                                    <span className="text-[11px] font-mono text-neutral-400">{agent}</span>
                                </div>
                                <span className={`text-[10px] font-mono ${getStatusColor(agents[agent].status)}`}>
                                    {agents[agent].message?.slice(0, 30) || agents[agent].status}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Tab Buttons */}
                    <div className="flex border-b border-neutral-800">
                        <button
                            onClick={() => setActiveTab('thoughts')}
                            className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors ${activeTab === 'thoughts'
                                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-400/5'
                                : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                        >
                            <Brain size={12} className="inline mr-1" />
                            AI Output
                        </button>
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors ${activeTab === 'logs'
                                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5'
                                : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                        >
                            <MessageSquare size={12} className="inline mr-1" />
                            Logs
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-3 py-2 min-h-[150px] max-h-[300px]">
                        {activeTab === 'thoughts' ? (
                            <div className="space-y-2">
                                {thoughts.length === 0 ? (
                                    <div className="text-[10px] text-neutral-600 italic text-center py-4">
                                        Waiting for AI activity...
                                    </div>
                                ) : (
                                    thoughts.map((thought, i) => (
                                        <div key={i} className="bg-neutral-800/50 rounded p-2 border border-neutral-700/50">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                {getThoughtIcon(thought.type)}
                                                <span className="text-[9px] font-semibold text-neutral-400">
                                                    {getThoughtLabel(thought.type, thought.toolName)}
                                                </span>
                                            </div>
                                            <pre className="text-[9px] font-mono text-neutral-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                                                {thought.content.slice(0, 500)}{thought.content.length > 500 ? '...' : ''}
                                            </pre>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {logs.length === 0 ? (
                                    <div className="text-[10px] text-neutral-600 italic text-center py-4">
                                        Waiting for logs...
                                    </div>
                                ) : (
                                    logs.slice(-15).map((log, i) => (
                                        <div key={i} className="text-[9px] font-mono leading-relaxed mb-1">
                                            <span className="text-neutral-600">[{log.agent}]</span>{' '}
                                            <span className={`break-all ${log.level === 'error' ? 'text-red-400' :
                                                log.level === 'warn' ? 'text-yellow-400' :
                                                    'text-neutral-400'
                                                }`}>{log.message.slice(0, 300)}{log.message.length > 300 ? '...' : ''}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
