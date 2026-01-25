"use client";

import React, { useMemo } from 'react';
import { Cpu, Mic2, Zap, Music } from 'lucide-react';
import { AgentStatus } from '@shared/services/monitor-service';

interface AgentConsoleProps {
    statuses: Record<string, AgentStatus>;
}

const AgentConsole = React.memo(({ statuses }: AgentConsoleProps) => {
    const agents = useMemo(() => [
        { id: 'WRITER', icon: <Cpu size={10} />, label: 'Writer' },
        { id: 'TTS', icon: <Mic2 size={10} />, label: 'TTS' },
        { id: 'DIRECTOR', icon: <Zap size={10} />, label: 'Director' },
        { id: 'MIXER', icon: <Music size={10} />, label: 'Mixer' },
    ], []);

    return (
        <div className="flex items-center gap-4 px-4 py-2 bg-black/20 backdrop-blur-md rounded-full border border-white/5">
            {agents.map(agent => (
                <div key={agent.id} className="flex items-center gap-1.5" title={statuses[agent.id]?.message}>
                    {/* Status Dot */}
                    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${statuses[agent.id]?.status === 'BUSY' ? 'bg-orange-400 animate-pulse' :
                            statuses[agent.id]?.status === 'READY' ? 'bg-emerald-400' :
                                statuses[agent.id]?.status === 'ERROR' ? 'bg-red-400' :
                                    'bg-white/20'
                        }`} />

                    {/* Label */}
                    <span className={`text-[9px] font-bold tracking-wider uppercase transition-colors ${statuses[agent.id]?.status === 'BUSY' ? 'text-white' : 'text-white/40'
                        }`}>
                        {agent.label}
                    </span>
                </div>
            ))}
        </div>
    );
});

AgentConsole.displayName = 'AgentConsole';

export default AgentConsole;
