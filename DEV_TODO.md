# RadioNowhere 开发路线图

> 版本：v2.0 | 最后更新：2026-02-08

---

## 目录

1. [项目愿景](#一项目愿景)
2. [架构规范](#二架构规范)
3. [开发标准](#三开发标准)
4. [任务清单](#四任务清单)
5. [实施计划](#五实施计划)
6. [成功指标](#六成功指标)

---

## 一、项目愿景

### 1.1 当前状态

RadioNowhere 是一个 AI 驱动的网络电台，目前实现了：
- ✅ 基础播放器 UI
- ✅ TTS 语音合成（Microsoft/Gemini）
- ✅ 音乐搜索与播放
- ✅ 多主持人系统
- ✅ ReAct Agent 内容生成

### 1.2 核心问题

| 问题 | 表现 | 影响 |
|------|------|------|
| 节目同质化 | 都是"鸡汤文+音乐" | 用户体验单调 |
| 音乐偏好固定 | 总是选相同歌手 | 缺乏新鲜感 |
| 内容深度不足 | 对话浅薄空洞 | 无真实电台感 |
| Agent 职责不清 | 单一 Writer 处理所有 | 难以优化 |

### 1.3 目标状态

```
┌────────────────────────────────────────────────────────┐
│                    RadioNowhere v2.0                    │
├────────────────────────────────────────────────────────┤
│  🎙️ 多样化节目类型                                      │
│     - 新闻播报、脱口秀、历史故事、音乐专题...            │
│                                                        │
│  🎵 智能音乐推荐                                        │
│     - 曲风维度驱动，避免歌手偏好                         │
│     - 根据节目类型自动调整音乐配比                       │
│                                                        │
│  🤖 专业化 Agent 系统                                   │
│     - 职责分离，每类节目有专属 Writer                    │
│     - 可扩展工具系统                                    │
│                                                        │
│  👤 个性化体验（未来）                                  │
│     - 用户偏好设置                                      │
│     - 智能推荐                                          │
└────────────────────────────────────────────────────────┘
```

---

## 二、架构规范

### 2.1 项目结构（Feature-Sliced Design）

```
src/
├── app/                    # Next.js App Router
├── features/               # 业务功能模块
│   ├── agents/             # Agent 调度系统
│   │   ├── lib/
│   │   │   ├── director-agent.ts      # 总导演
│   │   │   ├── director-types.ts      # 类型定义
│   │   │   ├── playback-controller.ts # 播放控制
│   │   │   ├── preload-manager.ts     # 预加载
│   │   │   ├── talk-executor.ts       # 对话执行
│   │   │   └── music-executor.ts      # 音乐执行
│   │   └── index.ts
│   │
│   ├── content/            # 内容生成模块
│   │   ├── lib/
│   │   │   ├── writer-agent.ts        # 编剧 Agent
│   │   │   ├── cast-system.ts         # 角色系统
│   │   │   ├── show-config.ts         # 节目配置 [NEW]
│   │   │   ├── writer-tools.ts        # 工具系统
│   │   │   ├── response-parser.ts     # 响应解析
│   │   │   └── prompt-templates/      # Prompt 模板 [NEW]
│   │   │       ├── base.ts
│   │   │       ├── talk.ts
│   │   │       ├── news.ts
│   │   │       ├── story.ts
│   │   │       ├── music.ts
│   │   │       └── index.ts
│   │   └── index.ts
│   │
│   ├── music-search/       # 音乐搜索模块
│   │   ├── lib/
│   │   │   ├── gd-music-service.ts    # 音乐 API
│   │   │   ├── diversity-manager.ts   # 多样性管理
│   │   │   └── genre-wheel.ts         # 曲风轮盘 [NEW]
│   │   └── index.ts
│   │
│   ├── tts/                # TTS 模块
│   ├── feedback/           # 用户反馈模块
│   └── history-tracking/   # 历史记录模块
│
├── shared/                 # 共享模块
│   ├── services/           # 基础服务
│   │   ├── audio-service/  # 音频混音器
│   │   ├── monitor-service/# 事件监控
│   │   └── storage-service/# 存储服务
│   ├── stores/             # 全局状态
│   ├── types/              # 类型定义
│   │   ├── radio-core.ts   # 核心类型
│   │   └── segment.ts      # 环节类型 [NEW]
│   └── utils/              # 工具函数
│
└── widgets/                # UI 组件
    └── radio-player/
        ├── ui/
        │   ├── index.tsx
        │   ├── SubtitleDisplay.tsx
        │   ├── TimelinePanel.tsx
        │   ├── MailboxDrawer.tsx
        │   └── PlayerActionBtn.tsx
        ├── hooks/
        │   └── useRadioPlayer.ts
        └── types.ts
```

### 2.2 Agent 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      DirectorAgent                           │
│                   (总导演：调度、决策)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │WriterAgent │  │ TTS Agent  │  │AudioMixer  │
    │  (编剧)    │  │ (语音合成) │  │ (混音器)   │
    └─────┬──────┘  └────────────┘  └────────────┘
          │
          │ 根据 ShowType 选择
          ▼
    ┌─────────────────────────────────────────┐
    │           Prompt Templates               │
    ├─────────┬─────────┬─────────┬───────────┤
    │  talk   │  news   │  story  │   music   │
    │ 脱口秀  │ 新闻    │ 故事    │  音乐专题  │
    └─────────┴─────────┴─────────┴───────────┘
          │
          │ 根据 ShowConfig 选择
          ▼
    ┌─────────────────────────────────────────┐
    │              Tool System                 │
    ├──────────────────────────────────────────┤
    │ search_music | fetch_news | search_knowledge │
    │ get_lyrics   | fetch_trending | submit_show  │
    └──────────────────────────────────────────┘
```

### 2.3 数据流

```
用户点击播放
    │
    ▼
DirectorAgent.startShow()
    │
    ├─→ CastDirector.randomShowType()  // 决定节目类型
    │       │
    │       ▼
    ├─→ WriterAgent.generateTimeline()
    │       │
    │       ├─→ getShowConfig(type)     // 获取节目配置
    │       ├─→ getPromptTemplate(type) // 获取专属 Prompt
    │       ├─→ getToolsForType(type)   // 获取专属工具
    │       └─→ AI 生成 → ShowTimeline
    │
    ├─→ prepareBlocks()                 // 预加载音频
    │       ├─→ TalkExecutor.prepare()  // TTS 合成
    │       └─→ MusicExecutor.prepare() // 音乐下载
    │
    └─→ executeTimeline()               // 执行播放
            │
            ├─→ radioMonitor.emit()     // 发送事件
            └─→ UI 更新
```

### 2.4 节目类型配比规范

| ShowType | 对话占比 | 音乐占比 | 音乐用途 | 必需工具 |
|----------|----------|----------|----------|----------|
| talk | 60-70% | 30-40% | 背景+过渡 | - |
| entertainment | 60-70% | 30-40% | 背景+过渡 | fetch_trending |
| news | 80-90% | 10-20% | 仅过渡 | fetch_news |
| history | 70-80% | 20-30% | 氛围+过渡 | search_knowledge |
| science | 70-80% | 20-30% | 氛围+过渡 | search_knowledge |
| mystery | 75-85% | 15-25% | 氛围烘托 | - |
| story | 65-75% | 25-35% | 情感渲染 | - |
| nighttalk | 65-75% | 25-35% | 情感渲染 | search_quotes |
| music | 30-40% | 60-70% | 主体内容 | search_music, get_lyrics |
| interview | 70-80% | 20-30% | 过渡 | - |
| drama | 85-95% | 5-15% | 场景+过渡 | - |

---

## 三、开发标准

### 3.1 代码规范

```typescript
// ✅ 好的做法
export interface ShowConfig {
    type: ShowType;
    talkRatio: [number, number];     // [min, max]
    musicRatio: [number, number];
    musicPurpose: MusicPurpose;
    requiredTools: ToolName[];
    optionalTools: ToolName[];
}

// ❌ 避免的做法
export interface Config {
    t: string;      // 不清晰的命名
    tr: number[];   // 缺少类型约束
    mp: string;     // 应使用枚举
}
```

### 3.2 文件命名规范

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 组件 | PascalCase | `SubtitleDisplay.tsx` |
| Hook | camelCase + use前缀 | `useRadioPlayer.ts` |
| 工具函数 | camelCase | `diversity-manager.ts` |
| 类型定义 | kebab-case | `radio-core.ts` |
| 常量 | UPPER_SNAKE_CASE | `SHOW_CONFIGS` |

### 3.3 Prompt 编写规范

```typescript
// ✅ 好的 Prompt 结构
const PROMPT_TEMPLATE = `
## 🎯 任务目标
[清晰描述要做什么]

## 📋 结构要求
[具体的结构和格式]

## ✅ 期望的表达
[正面示例]

## ❌ 禁止的内容
[负面示例]

## 🛠️ 可用工具
[工具列表和用法]
`;

// ❌ 避免的 Prompt
const BAD_PROMPT = `
请生成一个好的节目。要有趣，要深刻。
`;  // 太模糊，缺乏具体指导
```

### 3.4 工具定义规范

```typescript
// ✅ 标准工具定义
export const TOOL_DEFINITION: ToolDefinition = {
    name: 'search_knowledge',
    description: `搜索知识/百科内容。

适用场景：
- 历史故事节目需要史实依据
- 科普节目需要科学原理
- 文化节目需要背景知识

返回格式：
- title: 条目标题
- summary: 摘要（100-200字）
- source: 来源`,
    parameters: [
        {
            name: 'query',
            type: 'string',
            description: '搜索关键词（如：三国演义、量子力学、茶道文化）',
            required: true
        },
        {
            name: 'type',
            type: 'string',
            description: '知识类型：history/science/culture/general',
            required: false
        }
    ]
};
```

### 3.5 状态管理规范

```typescript
// ✅ 使用 React Context + Hooks
export function useRadioPlayer(): RadioPlayerState & RadioPlayerActions {
    const [state, setState] = useState<RadioPlayerState>(initialState);

    // 使用 useCallback 缓存方法
    const togglePlayback = useCallback(async () => {
        // ...
    }, [dependencies]);

    // 使用 useEffect 订阅事件
    useEffect(() => {
        const cleanup = radioMonitor.on('script', handler);
        return cleanup;
    }, []);

    return { ...state, togglePlayback };
}

// ❌ 避免的做法
// 直接在组件内定义复杂逻辑
// 不使用 useCallback 导致重复渲染
// 不清理事件监听器
```

### 3.6 错误处理规范

```typescript
// ✅ 标准错误处理
async function executeToolCall(name: string, args: unknown): Promise<ToolResult> {
    try {
        const result = await doSomething(args);
        return { success: true, data: result };
    } catch (error) {
        // 记录日志
        radioMonitor.log('WRITER', `Tool ${name} failed: ${error}`, 'error');

        // 返回友好错误信息
        return {
            success: false,
            error: `工具执行失败：${getErrorMessage(error)}`
        };
    }
}

// ❌ 避免的做法
async function badExample() {
    const result = await doSomething(); // 没有 try-catch
    return result; // 错误会导致整个流程崩溃
}
```

---

## 四、任务清单

### 4.1 Bug 修复 (P0)

#### BUG-001: 台词展开状态异常
- **文件**: `src/widgets/radio-player/ui/SubtitleDisplay.tsx`
- **问题**: Talk block 展开时切换到 music block，UI 进入异常状态
- **修复**:
```typescript
// 在第 101 行 useEffect 后添加
useEffect(() => {
    if (displayInfo.type !== 'talk' && isExpanded) {
        onExpandChange(false);
    }
}, [displayInfo.type, isExpanded, onExpandChange]);
```
- [ ] 实现修复
- [ ] 编写测试用例
- [ ] 验证：talk → music 切换时自动收起

#### BUG-002: 手机窄屏输入框适配
- **文件**: `src/widgets/radio-player/ui/MailboxDrawer.tsx`
- **问题**: 320px 屏幕上输入框和按钮被挤压
- **修复**:
```typescript
// 第 36 行
className="mt-6 w-full max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto"

// 第 73, 86 行按钮
className="p-2 sm:p-2.5 rounded-xl ..."
```
- [ ] 实现响应式修复
- [ ] 测试 320px、375px、414px 屏幕

#### BUG-003: 批量 TTS 台词显示同步
- **文件**: `src/widgets/radio-player/ui/SubtitleDisplay.tsx`
- **问题**: Gemini 批量 TTS 时，只显示最后一句台词
- **修复**: 处理 `isBatched` 和 `batchScripts` 字段
- [ ] 修改 SubtitleDisplay 处理批量脚本
- [ ] 测试多人对话显示

#### BUG-004: 禁止列表持久化
- **文件**: `src/features/music-search/lib/diversity-manager.ts`
- **问题**: 刷新页面后禁止列表重置
- **修复**: 使用 localStorage 持久化
- [ ] 添加 load/save 函数
- [ ] SSR 兼容处理

---

### 4.2 节目丰富度 (P1)

#### FEAT-001: 启用全部节目类型
- **文件**: `src/features/content/lib/cast-system.ts`
- **改动**: 修改 `randomShowType()` 使用加权随机
```typescript
const weights: Record<ShowType, number> = {
    talk: 15, interview: 10, news: 8, drama: 5,
    entertainment: 12, story: 10, history: 10,
    science: 10, mystery: 10, nighttalk: 8, music: 5
};
```
- [ ] 实现加权随机
- [ ] 启用 news 和 drama
- [ ] 验证类型分布

#### FEAT-002: 节目配置系统
- **新文件**: `src/features/content/lib/show-config.ts`
- **内容**: 定义各类型的对话/音乐配比
- [ ] 创建 ShowConfig 接口
- [ ] 定义 SHOW_CONFIGS 常量
- [ ] 导出配置获取函数

#### FEAT-003: 专属 Prompt 模板
- **新目录**: `src/features/content/lib/prompt-templates/`
- **文件**:
  - [ ] `base.ts` - 公共部分（电台身份、输出格式）
  - [ ] `talk.ts` - 脱口秀专属
  - [ ] `news.ts` - 新闻播报专属
  - [ ] `story.ts` - 故事/历史专属
  - [ ] `music.ts` - 音乐专题专属
  - [ ] `entertainment.ts` - 娱乐综艺专属
  - [ ] `index.ts` - 模板选择器

#### FEAT-004: 对话模式引导
- **文件**: `src/features/content/lib/prompt-templates/talk.ts`
- **内容**: 定义辩论式、叙事接力、吐槽式等对话模式
- [ ] 编写对话模式描述
- [ ] 添加正反面示例
- [ ] 集成到 Prompt

#### FEAT-005: 内容密度提升
- **文件**: 各 `prompt-templates/*.ts`
- **改动**: 台词要求 3-5 句 → 8-12 句
- [ ] 修改数量要求
- [ ] 添加禁止表达清单
- [ ] 添加期望表达示例

---

### 4.3 音乐多样性 (P1)

#### FEAT-006: 曲风轮盘系统
- **新文件**: `src/features/music-search/lib/genre-wheel.ts`
- **内容**:
```typescript
export const GENRE_DIMENSIONS = [
    { name: '流派', options: ['民谣/Folk', '摇滚/Rock', ...] },
    { name: '年代', options: ['60年代', '70年代', ...] },
    { name: '文化', options: ['华语', '欧美', '日韩', ...] },
    { name: '氛围', options: ['治愈', '激情', '忧郁', ...] }
];
```
- [ ] 定义曲风维度
- [ ] 实现 getGenreSuggestions()
- [ ] 实现 recordUsedGenre()
- [ ] 实现 getGenrePromptSection()

#### FEAT-007: 音乐专题节目曲风引导
- **文件**: `src/features/content/lib/writer-agent.ts`
- **改动**: 仅在 music 类型节目使用曲风轮盘
- [ ] 引入 genre-wheel
- [ ] 在 music 节目 Prompt 中添加曲风引导
- [ ] 其他节目类型不强制曲风要求

#### FEAT-008: 搜索工具曲风提示
- **文件**: `src/features/content/lib/writer-tools.ts`
- **改动**: 增加 genre_hint 参数
- [ ] 修改工具描述
- [ ] 增加参数
- [ ] 优化返回提示

---

### 4.4 Agent 系统升级 (P2)

#### ARCH-001: WriterAgent 重构
- **文件**: `src/features/content/lib/writer-agent.ts`
- **改动**:
```typescript
async generateTimeline(duration: number, showType?: ShowType) {
    const type = showType || castDirector.randomShowType();
    const config = getShowConfig(type);
    const prompt = this.buildPromptForType(type, config, duration);
    const tools = this.getToolsForType(type, config);
    return this.executeGeneration(prompt, tools);
}
```
- [ ] 实现 buildPromptForType()
- [ ] 实现 getToolsForType()
- [ ] 重构 generateTimeline()
- [ ] 迁移现有逻辑

#### ARCH-002: 工具系统扩展
- **文件**: `src/features/content/lib/writer-tools.ts`
- **新工具**:
  - [ ] `search_knowledge` - 知识/百科搜索
  - [ ] `fetch_trending` - 热点话题
  - [ ] `search_quotes` - 名言金句
  - [ ] `fetch_weather` - 天气信息
- [ ] 定义工具接口
- [ ] 实现工具逻辑
- [ ] 对接外部 API

#### ARCH-003: 节目环节系统
- **新文件**: `src/shared/types/segment.ts`
- **内容**:
```typescript
export type SegmentType =
    | 'opening' | 'main_topic' | 'music_break'
    | 'interaction' | 'closing';

export interface ShowSegment {
    type: SegmentType;
    durationHint: [number, number];
    blocks: TimelineBlock[];
}
```
- [ ] 定义环节类型
- [ ] 定义各节目类型的环节结构
- [ ] 修改 WriterAgent 按环节生成

---

### 4.5 功能扩展 (P3)

#### FEAT-009: 用户偏好系统
- **新文件**: `src/features/user-preferences/`
- **内容**:
```typescript
interface UserPreference {
    favoriteGenres: string[];
    dislikedGenres: string[];
    favoriteShowTypes: ShowType[];
    explorationLevel: 'conservative' | 'balanced' | 'adventurous';
}
```
- [ ] 设计数据结构
- [ ] 创建设置 UI
- [ ] 持久化到 localStorage
- [ ] 集成到内容生成

#### FEAT-010: 完整广播剧支持
- [ ] 设计多角色场景系统
- [ ] 实现简单音效支持
- [ ] 创建 drama 专属 Prompt
- [ ] 测试多角色对话

---

## 五、实施计划

### Phase 1: 紧急修复（1-3 天）

| 任务 ID | 任务名称 | 文件 | 优先级 | 状态 |
|---------|----------|------|--------|------|
| BUG-001 | 展开状态修复 | SubtitleDisplay.tsx | P0 | [ ] |
| BUG-002 | 窄屏适配 | MailboxDrawer.tsx | P0 | [ ] |
| BUG-004 | 禁止列表持久化 | diversity-manager.ts | P0 | [ ] |

**交付物**:
- 修复后的组件
- 测试通过截图

---

### Phase 2: 核心优化（1-2 周）

| 任务 ID | 任务名称 | 文件 | 优先级 | 状态 |
|---------|----------|------|--------|------|
| FEAT-001 | 启用全部节目类型 | cast-system.ts | P1 | [ ] |
| FEAT-002 | 节目配置系统 | show-config.ts (新) | P1 | [ ] |
| FEAT-003 | 专属 Prompt 模板 | prompt-templates/ (新) | P1 | [ ] |
| FEAT-004 | 对话模式引导 | prompt-templates/talk.ts | P1 | [ ] |
| FEAT-005 | 内容密度提升 | prompt-templates/*.ts | P1 | [ ] |
| BUG-003 | 批量 TTS 显示 | SubtitleDisplay.tsx | P1 | [ ] |

**交付物**:
- 新增配置文件
- Prompt 模板目录
- 更新后的 WriterAgent

---

### Phase 3: Agent 系统升级（2-4 周）

| 任务 ID | 任务名称 | 文件 | 优先级 | 状态 |
|---------|----------|------|--------|------|
| ARCH-001 | WriterAgent 重构 | writer-agent.ts | P2 | [ ] |
| FEAT-006 | 曲风轮盘系统 | genre-wheel.ts (新) | P2 | [ ] |
| FEAT-007 | 音乐节目曲风引导 | writer-agent.ts | P2 | [ ] |
| ARCH-002 | 工具系统扩展 | writer-tools.ts | P2 | [ ] |
| ARCH-003 | 节目环节系统 | segment.ts (新) | P2 | [ ] |

**交付物**:
- 重构后的 Agent 系统
- 新工具实现
- 环节系统原型

---

### Phase 4: 功能扩展（4-8 周）

| 任务 ID | 任务名称 | 文件 | 优先级 | 状态 |
|---------|----------|------|--------|------|
| ARCH-002.1 | search_knowledge 工具 | writer-tools.ts | P3 | [ ] |
| ARCH-002.2 | fetch_trending 工具 | writer-tools.ts | P3 | [ ] |
| FEAT-009 | 用户偏好系统 | user-preferences/ (新) | P3 | [ ] |
| FEAT-010 | 广播剧完整支持 | 多文件 | P3 | [ ] |

**交付物**:
- 完整工具系统
- 用户偏好 UI
- 广播剧演示

---

## 六、成功指标

### 6.1 量化指标

| 指标 | 当前值 | Phase 2 目标 | Phase 4 目标 |
|------|--------|--------------|--------------|
| 节目类型覆盖 | 3-4 种 | 8+ 种 | 11 种 |
| 每期平均台词数 | 15-20 句 | 40+ 句 | 50+ 句 |
| 纯对话节目占比 | 0% | 20% | 30-40% |
| 歌手重复率（连续3期） | 50%+ | 20% | <10% |
| 节目配比正确率 | - | 80% | 95% |

### 6.2 质量指标

| 指标 | 评估方法 | 目标 |
|------|----------|------|
| 内容深度 | 人工评审 | 无"空洞鸡汤"感 |
| 对话自然度 | 人工评审 | 有来有往，不像念稿 |
| 节目多样性 | 连续收听10期 | 明显感知不同风格 |
| 音乐惊喜感 | 用户反馈 | 发现新歌手/风格 |

### 6.3 技术指标

| 指标 | 当前值 | 目标 |
|------|--------|------|
| Prompt 长度 | 5000+ tokens | 按类型 1500-2500 |
| AI 调用次数/期 | 8-15 次 | 5-8 次 |
| 生成成功率 | 85% | 95% |
| 内存占用 | 无监控 | <500MB |

---

## 附录

### A. 新文件模板

#### show-config.ts
```typescript
import { ShowType } from './cast-system';

export type MusicPurpose = 'main' | 'background' | 'transition_only';

export interface ShowConfig {
    type: ShowType;
    talkRatio: [number, number];
    musicRatio: [number, number];
    musicPurpose: MusicPurpose;
    requiredTools: string[];
    optionalTools: string[];
    promptTemplate: string;
}

export const SHOW_CONFIGS: Record<ShowType, ShowConfig> = {
    // ...
};

export function getShowConfig(type: ShowType): ShowConfig {
    return SHOW_CONFIGS[type] || SHOW_CONFIGS.talk;
}
```

#### prompt-templates/base.ts
```typescript
import { RADIO } from '@shared/utils/constants';

export function getBasePrompt(): string {
    return `
## 📻 电台身份
- 电台名称：${RADIO.NAME} (${RADIO.SLOGAN})
- 频率：${RADIO.FREQUENCY}

## 📝 输出格式
严格按以下 JSON 格式输出：
{
  "id": "唯一ID",
  "title": "节目标题",
  "estimatedDuration": 数字,
  "blocks": [...]
}
`;
}
```

### B. 测试清单

```bash
# Phase 1 测试
npm test -- --grep "SubtitleDisplay"
npm test -- --grep "MailboxDrawer"

# Phase 2 测试
npm test -- --grep "cast-system"
npm test -- --grep "show-config"

# 手动测试
# 1. 连续生成 10 期节目，检查类型分布
# 2. 在 320px 设备上测试 MailboxDrawer
# 3. 验证音乐歌手不连续重复
```

---

*文档维护者: AI Assistant*
*最后更新: 2026-02-08*
