"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import RadioPlayer from "@/components/RadioPlayer";
import SettingsPanel from "@/components/SettingsPanel";
import ApiCallBubbles from "@/components/ApiCallBubbles";
import AgentMonitor from "@/components/AgentMonitor";

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black p-4 relative overflow-hidden">

      {/* API Call Bubbles */}
      <ApiCallBubbles />

      {/* Agent Monitor */}
      <AgentMonitor />

      {/* Settings Button */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="absolute top-4 right-4 z-20 p-2.5 bg-neutral-800/80 hover:bg-neutral-700 rounded-full transition-colors backdrop-blur-sm"
        aria-label="Settings"
      >
        <Settings size={20} className="text-neutral-400" />
      </button>

      {/* Settings Panel */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-neutral-800 via-black to-black opacity-80 z-0"></div>

      {/* Content */}
      <div className="z-10 w-full max-w-xl space-y-4 md:space-y-8 flex flex-col items-center">
        <div className="text-center space-y-1 md:space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-[0.15em] md:tracking-[0.2em] glitch-text">
            NOWHERE
          </h1>
          <p className="text-neutral-500 font-mono text-[10px] sm:text-xs md:text-sm tracking-widest opacity-80">
            THE FREQUENCY OF THE LOST
          </p>
        </div>

        <RadioPlayer />

        <div className="text-neutral-600 text-[9px] md:text-[10px] font-mono max-w-xs text-center opacity-60">
          CAUTION: PROLONGED LISTENING MAY CAUSE TEMPORAL DISPLACEMENT SYMPTOMS.
        </div>

        {/* Footer with Attribution */}
        <footer className="mt-8 pt-8 border-t border-neutral-900/50 w-full max-w-lg flex flex-col items-center gap-2 text-[10px] text-neutral-600 font-mono">
          <p>
            Music API provided by{" "}
            <a
              href="https://music.gdstudio.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-400 transition-colors underline decoration-neutral-800"
            >
              GD音乐台
            </a>
          </p>
          <div className="flex gap-4">
            <a
              href="https://github.com/CJackHwang/RadioNowhere"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-400 transition-colors"
            >
              Source Code
            </a>
            <span className="text-neutral-800">|</span>
            <a
              href="https://github.com/CJackHwang"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-400 transition-colors"
            >
              Author
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
