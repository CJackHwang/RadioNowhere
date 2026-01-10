# RadioNowhere / 无线电 nowhere

<div align="center">

**AI-Powered Internet Radio Platform / AI 驱动的网络电台平台**

[Next.js 16](https://nextjs.org) + [React 19](https://reactjs.org) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS 4](https://tailwindcss.com)

*An immersive AI-generated radio experience with multi-agent orchestration / 多智能体编排的沉浸式 AI 电台体验*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org)

</div>

---

## 🌟 项目简介 / Project Overview

**RadioNowhere** 是一个革命性的 AI 驱动网络电台平台，融合了先进的人工智能技术与沉浸式的音频体验。平台通过多智能体系统自动生成动态内容，提供个性化的电台节目，结合实时音乐播放、文本转语音和智能调度系统。

**RadioNowhere** is a revolutionary AI-powered internet radio platform that combines advanced artificial intelligence with immersive audio experiences. The platform automatically generates dynamic content through a multi-agent system, providing personalized radio shows with real-time music playback, text-to-speech, and intelligent scheduling.

### 🎭 世界观设定 / World Setting

故事发生在 2099 年的虚构城市 "Neon Veridia"，这里融合了赛博朋克的高科技与后气候崩溃的废土元素。电台 "Radio Nowhere - The Frequency of the Lost" 为迷失的灵魂提供慰藉，节目风格忧郁而温暖，充满了末世浪漫主义色彩。

Set in the fictional city of "Neon Veridia" in 2099, blending cyberpunk high-tech with post-climate collapse scavenging. The radio station "Radio Nowhere - The Frequency of the Lost" provides solace for lost souls, with a melancholic yet warm style full of post-apocalyptic romance.

---

## ✨ 核心特性 / Core Features

### 🤖 多智能体系统 / Multi-Agent System

| Agent | 功能 / Function | 特色 / Features |
|-------|----------------|----------------|
| **Writer Agent** | 节目内容创作 / Content Generation | 动态风格适配、主持人角色系统、上下文记忆 |
| **Director Agent** | 节目调度执行 / Show Orchestration | 双缓冲预加载、时间线管理、会话恢复 |
| **TTS Agent** | 语音合成 / Speech Synthesis | 30+ 语音选择、情感表达、缓存优化 |

### 🎵 音乐与音频 / Music & Audio

- **🎶 GD Studio 音乐搜索** - 智能音乐发现与推荐
- **📝 实时歌词解析** - LRC 格式歌词同步显示
- **🎛️ 音频混合器** - 语音与音乐的智能叠加
- **📡 Howler.js 音频引擎** - 高性能音频播放

### 🎨 用户界面 / User Interface

- **📻 电台播放器** - 状态控制、音频可视化、字幕显示
- **📅 节目日程表** - 时间线可视化、跳转控制
- **💬 系统终端** - 实时日志、Agent 状态监控
- **📮 听众邮箱** - 互动请求处理
- **⚙️ 设置面板** - API 配置、模型选择、语音测试

### 💾 数据持久化 / Data Persistence

- **🏠 localStorage 支持** - 设置和会话状态保持
- **⏯️ 会话恢复** - 中断点续播功能
- **🔄 上下文记忆** - 跨会话内容连贯性

---

## 🛠️ 技术栈 / Tech Stack

### 前端框架 / Frontend Framework

```typescript
Next.js 16.1     // React 全栈框架 / Full-stack React framework
React 19.2       // 用户界面库 / UI library
TypeScript 5.0    // 类型安全 / Type safety
Tailwind CSS 4   // 原子化 CSS / Utility-first CSS
```

### 动画与图标 / Animation & Icons

```typescript
Framer Motion     // 流畅动画 / Smooth animations
Lucide React      // 现代图标库 / Modern icon library
```

### 音频处理 / Audio Processing

```typescript
Howler.js 2.2.4  // Web 音频引擎 / Web audio engine
@types/howler    // TypeScript 类型 / TypeScript definitions
```

### AI 服务集成 / AI Service Integration

```typescript
@google/generative-ai  // Gemini AI 服务 / Gemini AI service
OpenAI GPT            // 语言模型 / Language models
Google Vertex AI      // 云端 AI / Cloud AI services
```

### 状态管理 / State Management

```typescript
Zustand 5.0.9    // 轻量级状态管理 / Lightweight state management
```

---

## 📁 项目结构 / Project Structure

```
radio-nowhere/
├── 📁 app/                    # Next.js 应用目录 / App directory
│   ├── 📁 api/               # API 路由 / API routes
│   ├── 📄 layout.tsx         # 根布局 / Root layout
│   ├── 📄 page.tsx           # 主页面 / Main page
│   └── 📄 globals.css        # 全局样式 / Global styles
├── 📁 components/            # React 组件 / React components
├── 📁 lib/                   # 核心逻辑库 / Core libraries
│   ├── 📁 agents/           # 智能体系统 / Agent system
│   │   ├── 📄 director_agent.ts   # 导演智能体 / Director agent
│   │   ├── 📄 tts_agent.ts        # TTS 智能体 / TTS agent
│   │   └── 📄 writer_agent.ts     # 编剧智能体 / Writer agent
│   ├── 📄 ai_service.ts           # AI 服务抽象 / AI service abstraction
│   ├── 📄 audio_mixer.ts          # 音频混合器 / Audio mixer
│   ├── 📄 cast_system.ts          # 角色系统 / Character system
│   ├── 📄 fictional_world.ts      # 世界观设定 / World setting
│   ├── 📄 gdmusic_service.ts      # 音乐服务 / Music service
│   ├── 📄 global_state.ts         # 全局状态 / Global state
│   ├── 📄 lrc_parser.ts           # 歌词解析 / Lyrics parser
│   ├── 📄 radio_monitor.ts        # 电台监控 / Radio monitor
│   ├── 📄 session_store.ts        # 会话存储 / Session store
│   ├── 📄 settings_store.ts       # 设置存储 / Settings store
│   └── 📄 tts_voices.ts          # TTS 语音配置 / TTS voices
├── 📁 public/               # 静态资源 / Static assets
└── 📁 types/                # TypeScript 类型定义 / Type definitions
```

---

## 🚀 快速开始 / Quick Start

### 环境要求 / Prerequisites

- **Node.js** 18.0+ 
- **npm** / **yarn** / **pnpm** / **bun**

### 安装步骤 / Installation

1. **克隆项目 / Clone the repository**
   ```bash
   git clone <repository-url>
   cd radio-nowhere
   ```

2. **安装依赖 / Install dependencies**
   ```bash
   npm install
   # 或 / or
   yarn install
   # 或 / or  
   pnpm install
   # 或 / or
   bun install
   ```

3. **启动开发服务器 / Start development server**
   ```bash
   npm run dev
   # 或 / or
   yarn dev
   ```

4. **访问应用 / Open the app**
   
   打开浏览器访问 / Open your browser to:
   **[http://localhost:3000](http://localhost:3000)**

### 生产构建 / Production Build

```bash
# 构建 / Build
npm run build

# 启动生产服务器 / Start production server
npm start
```

---

## 🎯 功能详解 / Feature Details

### 🤖 Writer Agent - 编剧智能体

**动态内容生成系统**，根据时间段和上下文自动生成电台节目内容。

**Dynamic content generation system** that automatically creates radio show content based on time periods and context.

#### 核心功能 / Core Functions:
- **🎭 角色系统** - 支持多种主持人角色切换
- **⏰ 时段适配** - 根据时间自动调整节目风格
- **🌍 上下文记忆** - 维护故事世界连贯性
- **📝 台本生成** - 智能生成对话、新闻、广告内容

### 🎬 Director Agent - 导演智能体

**节目调度与执行系统**，负责整体节目流程控制和时间管理。

**Show scheduling and execution system** responsible for overall program flow control and time management.

#### 核心功能 / Core Functions:
- **⏯️ 时间线执行** - 精确控制节目节奏
- **🔄 双缓冲预加载** - 优化播放体验
- **🎵 音乐控制** - 智能音乐选择与切换
- **💾 会话恢复** - 支持中断点续播

### 🎤 TTS Agent - 语音合成智能体

**多语音文本转语音系统**，提供丰富的语音选择和情感表达。

**Multi-voice text-to-speech system** providing rich voice options and emotional expression.

#### 支持的语音 / Supported Voices:
- **🌟 Gemini/Vertex 语音** - 30+ 预设语音
- **😊 情感表达** - 快乐、忧郁、兴奋、平静等
- **🚀 缓存优化** - 智能缓存减少重复请求
- **⚡ 速率限制** - 自动处理 API 调用限制

### 🎵 音乐系统 / Music System

#### GD Studio 音乐服务 / GD Studio Music Service:
- **🔍 智能搜索** - 基于关键词的 AI 音乐推荐
- **📊 音乐信息** - 完整歌曲元数据获取
- **🎤 歌词同步** - LRC 格式歌词实时显示
- **📡 音频流** - 高质量音频流播放

#### 音频混合器 / Audio Mixer:
- **🔊 多轨混音** - 语音与音乐智能叠加
- **🎚️ 音量控制** - 独立轨道音量调节
- **🎧 立体声效果** - 空间音频处理
- **⚡ 低延迟** - 实时音频处理

---

## 🔌 API 集成 / API Integration

### 支持的 AI 服务 / Supported AI Services

#### 🤖 OpenAI
```typescript
// GPT 模型支持 / GPT model support
- GPT-4        // 最强语言理解 / Best language understanding
- GPT-3.5-turbo // 平衡性能与速度 / Balanced performance & speed
```

#### 🌟 Google Gemini
```typescript
// Gemini 模型支持 / Gemini model support  
- gemini-pro   // 通用对话模型 / General conversational model
- gemini-pro-vision // 多模态理解 / Multimodal understanding
```

#### ☁️ Google Vertex AI
```typescript
// Vertex AI 服务 / Vertex AI services
- Text-to-Speech API // 语音合成 / Speech synthesis
- Speech-to-Text API // 语音识别 / Speech recognition
- Translation API    // 翻译服务 / Translation service
```

### 环境变量配置 / Environment Configuration

```bash
# 必需配置 / Required Configuration
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key

# 可选配置 / Optional Configuration  
VERTEX_PROJECT_ID=your_vertex_project_id
VERTEX_LOCATION=us-central1

# 音乐服务 / Music Service
GDMUSIC_API_KEY=your_gdmusic_api_key

# 开发配置 / Development
NODE_ENV=development
```

---

## ⚙️ 配置说明 / Configuration Guide

### 🎛️ 设置面板功能 / Settings Panel Features

#### API 配置 / API Configuration
- **🔑 API Key 管理** - 安全的密钥存储
- **🌐 服务端点配置** - 自定义 API 地址
- **🔍 连接测试** - 实时验证连接状态
- **⚡ 性能监控** - API 响应时间统计

#### 语音设置 / Voice Settings
- **🎤 语音选择** - 30+ TTS 语音预览
- **😊 情感调节** - 语音情感强度控制
- **⚡ 语速设置** - 播放速度调节
- **🔊 音量平衡** - 语音与音乐比例

#### 播放器设置 / Player Settings
- **🎚️ 音频质量** - 音质与带宽平衡
- **📡 预加载设置** - 缓冲区大小配置
- **⏯️ 自动播放** - 启动时自动开始
- **🔄 循环模式** - 节目循环播放选项

### 💾 数据持久化 / Data Persistence

#### localStorage 存储项 / Storage Items:
```typescript
interface StoredData {
  settings: AppSettings      // 用户设置 / User settings
  session: SessionData      // 会话数据 / Session data  
  preferences: UserPrefs   // 用户偏好 / User preferences
  cache: CacheData         // 缓存数据 / Cache data
}
```

#### 会话恢复流程 / Session Recovery Flow:
1. **检测会话** / Detect Session → 检查本地存储 / Check local storage
2. **加载状态** / Load State → 恢复播放位置 / Restore playback position  
3. **重建上下文** / Rebuild Context → 恢复 Agent 状态 / Restore agent states
4. **继续播放** / Resume Playback → 无缝继续体验 / Seamless continuation

---

## 👨‍💻 开发指南 / Development Guide

### 🏗️ 添加新功能 / Adding New Features

#### 1. 创建新的 Agent / Create New Agent
```typescript
// lib/agents/new_agent.ts
export class NewAgent {
  async process(input: any): Promise<any> {
    // 实现逻辑 / Implementation logic
  }
}
```

#### 2. 扩展 UI 组件 / Extend UI Components
```typescript
// components/NewComponent.tsx
export function NewComponent() {
  return (
    <div className="new-component">
      {/* 组件内容 / Component content */}
    </div>
  )
}
```

#### 3. 添加新的 AI 服务 / Add New AI Service
```typescript
// lib/ai_service.ts
export class NewAIService {
  async callAPI(prompt: string): Promise<string> {
    // API 调用逻辑 / API call logic
  }
}
```

### 🔧 开发工具 / Development Tools

#### 代码检查 / Code Quality
```bash
# ESLint 检查 / ESLint check
npm run lint

# TypeScript 类型检查 / TypeScript type check  
npm run type-check

# 格式化代码 / Format code
npm run format
```

#### 调试工具 / Debug Tools
- **🔍 Chrome DevTools** - 浏览器开发工具
- **📊 React DevTools** - React 组件调试
- **🌐 Network Tab** - API 请求监控
- **💾 Application Tab** - localStorage 调试

### 🎯 性能优化 / Performance Optimization

#### 音频性能 / Audio Performance
- **🎵 音频压缩** - 选择合适的音频格式
- **📡 流式播放** - 减少初始加载时间  
- **🔄 智能缓存** - 预加载热门内容
- **⚡ 延迟优化** - 最小化音频延迟

#### 内存管理 / Memory Management
- **🗑️ 垃圾回收** - 及时清理音频资源
- **📦 资源池** - 重用音频对象
- **💾 缓存策略** - 平衡内存与性能
- **🔍 内存监控** - 实时内存使用追踪

---

## 🤝 贡献指南 / Contributing Guide

我们欢迎所有形式的贡献！无论是 bug 报告、功能建议、代码贡献，还是文档改进。

We welcome all forms of contribution! Whether it's bug reports, feature requests, code contributions, or documentation improvements.

### 📋 贡献流程 / Contribution Process

1. **🍴 Fork 项目** - 点击右上角 Fork 按钮
2. **🌿 创建分支** - `git checkout -b feature/amazing-feature`
3. **✏️ 提交更改** - `git commit -m 'Add amazing feature'`
4. **📤 推送分支** - `git push origin feature/amazing-feature`
5. **📝 创建 PR** - 提交 Pull Request

### 🐛 报告 Bug / Bug Reports

请使用 [Issues](../../issues) 页面报告 bug，并包含以下信息：

Please use the [Issues](../../issues) page to report bugs and include the following information:

- **🐛 Bug 描述** / Bug description
- **🔄 重现步骤** / Steps to reproduce  
- **💭 预期行为** / Expected behavior
- **📷 截图/日志** / Screenshots/logs
- **🖥️ 环境信息** / Environment info

### 💡 功能请求 / Feature Requests

我们同样欢迎新功能建议！请详细描述：

We also welcome new feature suggestions! Please describe in detail:

- **🎯 功能目标** / Feature goal
- **💭 使用场景** / Use case
- **🔄 实现思路** / Implementation approach
- **🎨 UI/UX 考虑** / UI/UX considerations

---

## 📄 许可证 / License

本项目基于 [MIT 许可证](./LICENSE) 开源。

This project is open source under the [MIT License](./LICENSE).

---

## 🙏 致谢 / Acknowledgments

感谢所有为本项目做出贡献的开发者和设计师！

Thanks to all developers and designers who have contributed to this project!

### 🌟 核心技术 / Core Technologies

- **[Next.js](https://nextjs.org)** - 强大的 React 框架
- **[React](https://reactjs.org)** - 用户界面库
- **[TypeScript](https://www.typescriptlang.org)** - 类型安全的 JavaScript
- **[Tailwind CSS](https://tailwindcss.com)** - 实用优先的 CSS 框架
- **[Framer Motion](https://framer.com/motion/)** - 流畅动画库
- **[Howler.js](https://howlerjs.com)** - Web 音频引擎

### 🤝 特别感谢 / Special Thanks

- 所有贡献者和测试用户 / All contributors and test users
- 开源社区的支持 / Open source community support
- AI 技术的发展推动者 / AI technology development promoters

---

<div align="center">

**🎵 RadioNowhere - Where AI Meets Radio / 人工智能遇见电台 🎵**

[⭐ Star this repo](https://github.com/your-repo/radio-nowhere) | [🐛 Report Bug](https://github.com/your-repo/radio-nowhere/issues) | [💡 Request Feature](https://github.com/your-repo/radio-nowhere/issues)

</div>