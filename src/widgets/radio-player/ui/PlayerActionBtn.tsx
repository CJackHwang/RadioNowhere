"use client";

import React from 'react';

interface PlayerActionBtnProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
}

export default function PlayerActionBtn({
    icon,
    label,
    onClick,
    active = false,
    disabled = false
}: PlayerActionBtnProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex flex-col items-center gap-1 group transition-all ${disabled ? 'opacity-30 cursor-not-allowed' : ''
                } ${active ? 'text-emerald-500' : 'text-neutral-600 hover:text-neutral-400'}`}
        >
            <div className={`p-2 rounded-xl transition-all ${active ? 'bg-emerald-500/10' : 'group-hover:bg-white/5'
                }`}>
                {icon}
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
        </button>
    );
}
