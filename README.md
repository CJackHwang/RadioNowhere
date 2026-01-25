# RadioNowhere

<div align="center">

**AI-Generated Internet Radio / AI 生成的网络电台**

[Next.js 16](https://nextjs.org) + [React 19](https://reactjs.org) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS 4](https://tailwindcss.com)

*A multi-agent orchestrated AI radio experience with real-time content generation and intelligent audio mixing.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org)

</div>

---

## 📻 Project Overview

**RadioNowhere** is an AI-driven internet radio platform that generates dynamic radio shows in real-time using a multi-agent system. The platform features three core agents working in concert:

- **Writer Agent** - Generates radio content using ReAct tool-calling pattern
- **Director Agent** - Orchestrates show timelines with double-buffered preloading
- **TTS Agent** - Converts text to speech with 30+ voice options

The radio station operates under the identity **"NOWHERE FM 404.2"** (无处电台), broadcasting diverse programs including talk shows, historical stories, science trivia, urban legends, interviews, late-night thoughts, music specials, and interactive entertainment.

### 🎭 World Setting

The station exists in a fictional atmosphere blending cyberpunk aesthetics with post-apocalyptic warmth. **Radio Nowhere - The Frequency of the Lost** provides solace for wandering souls through melancholic yet comforting programming, creating a unique "post-apocalyptic romanticism" experience.

---

## ✨ Core Features

### 🤖 Multi-Agent System

| Agent | Role | Key Features |
|-------|------|--------------|
| **Writer Agent** | Content Generation | ReAct tool-calling (MAX_REACT_LOOPS: 30), dynamic program types, multi-character support, world-bible context |
| **Director Agent** | Show Orchestration | Timeline management, double-buffered preloading, session persistence, music URL caching (10min TTL) |
| **TTS Agent** | Speech Synthesis | 30+ Gemini voices, Microsoft TTS backup, priority queue (MAX_CONCURRENT_TTS: 5), audio caching |

### 🎭 Program Types

The Writer Agent dynamically generates diverse content:

- **💬 Talk Show / 脱口秀** - Lively conversations between hosts sharing life anecdotes and trending topics
- **📚 Historical Stories / 历史风云** - Historical narratives, biographies, and tales of dynasties
- **🔬 Science Trivia / 科普百科** - Interesting scientific knowledge, natural mysteries, and fun facts
- **👻 Urban Legends / 奇闻异事** - Urban legends and unsolved mysteries (suspenseful but not too scary)
- **🎤 Interviews / 访谈对话** - Simulated interviews with celebrities, experts, or fictional characters
- **🌙 Late Night Thoughts / 深夜心声** - Emotional topics and life insights (perfect for quiet hours)
- **🎵 Music Specials / 音乐专题** - Introductions to genres, artists, or stories behind music
- **🎪 Interactive Entertainment / 娱乐互动** - Fun discussions, games, and light-hearted comedy

### 🎵 Audio System

- **🎶 GD Studio Music API** - Smart music discovery with netease/kuwo/joox sources
- **📝 LRC Lyrics Parser** - Real-time synchronized lyrics display
- **🎛️ Audio Mixer** - Multi-track mixing with independent volume controls and fade effects
- **📡 Howler.js Engine** - High-performance web audio playback
- **🎚️ Smart Mixing** - Automatic volume ducking (MUSIC_DURING_VOICE: 0.15)

### 🎨 User Interface

- **📻 RadioPlayer** - Main player with Agent console, subtitle display, playback controls, and visualizer
- **📅 Program Schedule** - Timeline visualization with jump controls
- **💬 System Terminal** - Real-time logs and agent status monitoring
- **📮 Mailbox** - Listener request queue for interactive content
- **⚙️ Settings Panel** - API configuration, model selection, voice testing, and preload tuning

### 💾 Data Persistence

- **🏠 localStorage Support** - Settings, session, preferences, and cache storage
- **⏯️ Session Recovery** - Full playback restoration with context rebuilding
- **🔄 Context Memory** - Cross-session content continuity with GlobalState management
- **📜 History Tracking** - Show history (max 50) and track history (max 100)

---

## 🛠️ Tech Stack

```yaml
Framework:
  - Next.js: 16.1.1        # App Router for full-stack React
  - React: 19.2.3          # Latest React with concurrent features
  - TypeScript: 5.0         # Type-safe development

Path Aliases:
  - @shared:               # Shared utilities, services, components
  - @entities:             # Business entities and models
  - @features:             # User-facing features and business logic
  - @widgets:              # Compositional UI components
  - @pages:                # Page-level components
  - @app:                  # Application-wide setup

Styling & Animation:
  - Tailwind CSS: 4        # Utility-first CSS with v4 improvements
  - tailwind-merge: 3.4.0  # Merge Tailwind classes intelligently
  - Framer Motion: 12.25.0 # Production-ready animation library
  - Lucide React: 0.562.0  # Beautiful & consistent icon toolkit

Audio & State:
  - Howler.js: 2.2.4       # Web audio engine
  - @types/howler: 2.2.12 # TypeScript definitions
  - Zustand: 5.0.9         # Lightweight state management

AI Services:
  - @google/generative-ai: 0.24.1  # Gemini AI SDK

Utilities:
  - clsx: 2.1.1            # Conditional className utility
```

---

## 📁 Project Structure (FSD)

The project follows the **Feature-Sliced Design (FSD)** architecture for better scalability and maintainability.

```
radio-nowhere/
├── app/                          # Next.js App Router (Pages Layer)
│   ├── api/proxy/                # API proxy route
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main entry point
│
├── src/
│   ├── widgets/                  # Compositional UI (Widgets Layer)
│   │   ├── radio-player/         # Main Radio Player widget
│   │   ├── settings-panel/       # Configuration panel widget
│   │   └── agent-monitor/        # Agent status monitoring widget
│   │
│   ├── features/                 # User-facing functionality (Features Layer)
│   │   ├── agents/               # Director Agent & Execution logic
│   │   ├── content/              # Writer Agent & Script generation
│   │   ├── tts/                  # Text-to-Speech logic & providers
│   │   ├── music-search/         # GD Music API & Search logic
│   │   ├── history-tracking/     # Playback history
│   │   └── time-announcement/    # Hourly time service
│   │
│   ├── shared/                   # Common resources (Shared Layer)
│   │   ├── services/             # Core services (Audio, AI, Storage)
│   │   ├── types/                # Core domain types
│   │   ├── hooks/                # Reusable React hooks
│   │   └── ui/                   # Project-wide UI components
│
├── public/                       # Static assets
└── package.json
```

---

## 🤖 Agent Architecture

### Writer Agent (`@features/content/lib/writer-agent.ts`)

The Writer Agent generates radio content using the ReAct (Reasoning + Acting) pattern with a tool-calling capability.

**Key Features:**

- **ReAct Loops**: Up to 30 reasoning-acting cycles per show generation
- **Tool Calling**: Five built-in tools:
  - `search_music` - Search for specific artists or songs via GD Studio API
  - `get_lyrics` - Fetch LRC format lyrics for music integration
  - `fetch_news` - Get today's trending news for content inspiration
  - `check_duplicate` - Verify concept uniqueness within 1-hour history
  - `submit_show` - Submit the final ShowTimeline JSON
- **Dynamic Character System**: Multi-character support (Aoede, Gacrux, Puck, Charon, Kore)
- **Time-Aware Content**: Adapts program selection to current time of day
- **Context Memory**: Maintains story world coherence through `@features/content/lib/world-context.ts`

### Director Agent (`@features/agents/lib/director-agent.ts`)

The Director Agent orchestrates the entire radio show, managing timelines, audio playback, and session persistence.

**Key Features:**

- **Timeline Management**: Executes `ShowTimeline` via `playback-controller.ts` and `music-executor.ts`.
- **Double-Buffered Preloading**: Generates next timeline segment while current one is playing (`preload-manager.ts`).
- **Session Persistence**: Complete session state saving/resuming via `SessionStore`.
- **Time Announcements**: Automatic hourly time announcements.
- **Error Recovery**: Automatic block retry logic with graceful degradation.

### TTS Agent (`@features/tts/lib/tts-agent.ts`)

The TTS Agent handles all text-to-speech generation with support for Gemini and Microsoft TTS.

**Key Features:**

- **Gemini TTS Support**: 30+ voice options with dynamic style prompting.
- **Microsoft TTS Fallback**: Alternative provider with high customizability.
- **Priority Queue**: Processes TTS requests based on execution urgency.
- **Audio Caching**: Caches generated audio in `StorageService` to minimize API latency.

---

## 🎛️ Audio System

### Audio Service (`@shared/services/audio-service/mixer.ts`)

A multi-track audio controller using Howler.js for seamless music and voice mixing.

**Features:**

- **Dual Tracks**: Independent music and voice track management with dynamic cross-fading.
- **Volume Ducking**: Automatically ducks music volume (15%) when speech is playing.
- **PCM Support**: Converts Gemini 24kHz PCM data to WAV for browser playback.

### Music Search Feature (`@features/music-search/lib/gd-music-service.ts`)

Integrates with GD Studio Music API for smart music discovery.

- **Multiple Sources**: Netease, Kuwo, Joox support.
- **Lyrics Engine**: Integrated `@features/music-search/lib/lyrics-parser.ts` for real-time synchronization.

---

## 🔌 API Integration

### Environment Configuration

Configure API keys through the **Settings Panel** (stored in `localStorage`):

- **AI Service**: OpenAI-compatible, Google Gemini, or Vertex AI.
- **TTS Provider**: Gemini (Native) or Microsoft (Edge-style).
- **Playback Control**: Preload depth and audio quality settings.

---

## 🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone <repository-url>
   npm install
   ```

2. **Start Development**
   ```bash
   npm run dev
   ```

3. **Configure**
   - Open [http://localhost:3000](http://localhost:3000)
   - Click the **Settings** icon
   - Enter your **Gemini/OpenAI API Key**
   - Click **Connect** to start the broadcast

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

**🎵 RadioNowhere - The Frequency of the Lost 🎵**

</div>
