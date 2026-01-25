"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import RadioPlayer from "@widgets/radio-player";
import SettingsPanel from "@widgets/settings-panel";
import ApiCallBubbles from "@features/agents/ui/api-bubbles";
import AgentMonitor from "@widgets/agent-monitor";

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <main className="flex min-h-dvh flex-col items-center bg-[#020202] p-4 relative selection:bg-pink-500/30 overflow-y-auto">

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

      {/* Background Ambience - Static */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-violet-900/10 rounded-full blur-[100px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-orange-900/10 rounded-full blur-[80px] mix-blend-screen" />
      </div>

      {/* Content */}
      <div className="z-10 w-full max-w-2xl space-y-6 md:space-y-10 flex flex-col items-center py-12 my-auto">
        <div className="text-center space-y-1 md:space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-[0.15em] md:tracking-[0.2em] glitch-text hover:scale-105 transition-transform duration-500 cursor-default">
            NOWHERE
          </h1>
          <p className="text-neutral-500 font-mono text-[10px] sm:text-xs md:text-sm tracking-widest opacity-80">
            THE FREQUENCY OF THE LOST
          </p>
        </div>

        <RadioPlayer />


        {/* Footer with Attribution - Restored */}
        <footer className="mt-8 pt-6 border-t border-white/5 w-full max-w-lg flex flex-col items-center gap-3 text-[10px] text-neutral-500 font-mono">
          <p>
            Music API provided by{" "}
            <a
              href="https://music.gdstudio.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-vibrant-gradient hover:text-transparent hover:bg-clip-text transition-all underline decoration-neutral-800 underline-offset-2"
            >
              GD音乐台
            </a>
          </p>
          <div className="flex gap-4 items-center">
            <a
              href="https://github.com/CJackHwang/RadioNowhere"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10"
            >
              <svg height="12" width="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
              </svg>
              Source Code
            </a>
            <span className="text-neutral-800">|</span>
            <a
              href="https://github.com/CJackHwang"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Author
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
