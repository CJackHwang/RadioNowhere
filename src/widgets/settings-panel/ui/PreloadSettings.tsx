"use client";

import React from 'react';
import { IApiSettings } from '@shared/services/storage-service/settings';

interface PreloadSettingsProps {
    settings: IApiSettings;
    onSettingChange: (field: keyof IApiSettings, value: number) => void;
}

export default function PreloadSettings({
    settings,
    onSettingChange,
}: PreloadSettingsProps) {
    return (
        <div className="space-y-3 pt-3 border-t border-neutral-800">
            <label className="text-sm font-medium text-neutral-400">预加载设置</label>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">提前准备节目数量</span>
                    <span className="text-sm font-mono text-emerald-400">{settings.preloadBlockCount}</span>
                </div>
                <input
                    type="range"
                    min={1}
                    max={10}
                    value={settings.preloadBlockCount}
                    onChange={(e) => onSettingChange("preloadBlockCount", parseInt(e.target.value))}
                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-600">
                    <span>1 (省内存)</span>
                    <span className="text-emerald-500">推荐: 3</span>
                    <span>10 (流畅)</span>
                </div>
                <p className="text-xs text-neutral-500">
                    数值越大播放越流畅，但消耗更多内存和 API 调用
                </p>
            </div>
        </div>
    );
}
