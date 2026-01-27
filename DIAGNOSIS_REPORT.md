# RadioNowhere 诊断报告（深度代码审查）

> 范围：本报告基于当前仓库代码（重点：`src/widgets/radio-player/ui/*`、`src/widgets/radio-player/hooks/useRadioPlayer.ts`、`src/features/agents/lib/*`、`src/shared/services/monitor-service/*`）对 3 个已知问题进行根因分析与改进方向建议。

---

## 问题 1：台词展开时自动切换到音乐界面异常显示

### 1.1 相关代码定位

- 展开状态由 `RadioPlayer` 顶层管理：
  - `src/widgets/radio-player/index.tsx`
    - `const [isSubtitleExpanded, setIsSubtitleExpanded] = React.useState(false);`
    - 传入：`<SubtitleDisplay isExpanded={isSubtitleExpanded} onExpandChange={setIsSubtitleExpanded} />`
    - 控制区（播放按钮等）用 `motion.div` 根据 `isSubtitleExpanded` 动画隐藏：
      - `height: isSubtitleExpanded ? 0 : 'auto'`
      - `opacity: isSubtitleExpanded ? 0 : 1`

- 台词/音乐 UI 切换逻辑集中在 `SubtitleDisplay`：
  - `src/widgets/radio-player/ui/SubtitleDisplay.tsx`
    - `useEffect([currentLine])` 将 `currentLine: ScriptEvent` 映射为 `displayInfo`：`talk | music | system | idle`
    - `showCover = displayInfo.type !== 'talk' && !isExpanded;`
    - 台词展开区域只在 `displayInfo.type === 'talk'` 时渲染（并且点击展开）：
      - `displayInfo.subtitle && displayInfo.type === 'talk' && (...)`
    - 当 `isExpanded` 为 true，会渲染一个“Mini Header”（小封面 + displayName + type），不区分 talk/music。

- `currentLine` / `currentBlockId` 的更新来源：
  - `src/widgets/radio-player/hooks/useRadioPlayer.ts`
    - 订阅 `radioMonitor.on('script', ...)`：
      - `setCurrentScript(data);`
      - `setCurrentBlockId(data.blockId);`

- `script` 事件在导演/执行器中发出：
  - `src/features/agents/lib/director-agent.ts`
    - 每个 block 开始时：
      - `radioMonitor.emitScript(block.type === 'talk' ? 'host1' : 'system', \`Playing: ${block.type}\`, block.id);`
  - `src/features/agents/lib/talk-executor.ts`
    - 单句模式：每句 `radioMonitor.emitScript(script.speaker, script.text, block.id)` 并播放对应音频。
    - Batched 模式：**先同步 emit 全部 scripts**，然后一次性播放 batched 音频。

### 1.2 根因分析：状态与时序

#### 1.2.1 状态流转图（核心变量）

关键状态：
- `isSubtitleExpanded`：用户 UI 状态（展开/收起），由用户点击控制
- `currentBlockId`：来自 `ScriptEvent.blockId`，每次 emitScript 都会更新
- `currentBlock.type`：实际 block 类型（talk/music），UI 并没有直接从 timeline block 推导，而是从 `currentLine` 推导 `displayInfo.type`

```
[用户点击台词区域] -> isSubtitleExpanded = true

(节目执行)
  emitScript(speaker,text,blockId)  ---> currentLine 更新 ----> SubtitleDisplay useEffect
                                         currentBlockId 更新

SubtitleDisplay useEffect:
  if speaker/music关键词 => displayInfo.type = 'music'
  else if speaker=system => 'system'
  else => 'talk'

渲染：
  - 展开区域(长台词) 只在 displayInfo.type==='talk' 时出现
  - showCover = displayInfo.type!=='talk' && !isExpanded
  - isExpanded=true 时会渲染 Mini Header（不区分 talk/music）
```

#### 1.2.2 异常触发的关键时序（“展开时刚好切到音乐”）

1) 用户正在看 talk block，点击展开：`isSubtitleExpanded=true`，SubtitleDisplay 进入 expanded layout。
2) 恰好此刻 block 切换到 music：导演层在 block start 会 emit：
   - `speaker='system'`
   - `text='Playing: music'`
   - `blockId=<music-block-id>`
3) SubtitleDisplay 收到 `currentLine` 更新：
   - `speaker === 'system'` 分支 -> `displayInfo.type='system'`，displayName 是 `text.slice(0,30)`
   - **并不会进入 music 分支**（因为这里不是 `speaker='music'` 也没有 `musicMeta`）
4) 在 expanded 状态下：
   - talk 的展开正文区域被移除（因为 `displayInfo.type !== 'talk'`）
   - 但 expanded 的 Mini Header 仍会渲染（且里面会展示 `displayInfo.displayName` 与 `displayInfo.type`）
   - 此时 “expanded 布局 + system 类型” 会导致：
     - 页面结构从“可滚动长台词”瞬间切换为“一个 header + 空白区域”的布局
     - Framer Motion `layout` 在多处同时生效（外层 + 正文容器），在高度急剧变化时容易出现：
       - 高度计算闪烁
       - 动画期间的层级/overflow 裁切异常（尤其是 parent 有 `overflow-hidden`）

#### 1.2.3 叠加问题：Framer Motion 的 layout 与条件渲染

当前 SubtitleDisplay 的关键点：
- 多个节点使用 `layout`（外层 subtitle wrapper、正文容器）
- 条件渲染会在同一帧内大幅改变树结构（talk->system/music）
- expanded 状态下：
  - `showCover` 被强制 false
  - 但 Mini Header 始终显示
  - talk 正文区域直接消失

这种“结构突变 + layout 动画”组合，很容易出现：
- 高度从 `flex-1 overflow-y-auto` 变成无内容，motion 仍在尝试 layout 过渡
- parent 容器（`RadioPlayer` 主卡片）也有 `overflow-hidden`，容易出现裁切/抖动

### 1.3 额外隐患：music 判定过于宽松

`SubtitleDisplay` 的 music 判定：
```ts
if (speaker === 'music' || speaker === 'dj' || lowerText.includes('music'))
```
这会把大量系统文本（例如包含 music 关键词）归入 music UI。与此同时，导演在 block start emit：`speaker='system' text='Playing: music'` 会同时满足 `lowerText.includes('music')`，从而被错误识别为 music（取决于分支顺序：当前代码先判断 speaker/music 关键词，再判断 system；因此 `speaker='system'` 但 `text` 含 music，会走 music 分支）。

这意味着：
- 切到 music block 的第一条脚本事件实际上可能被当成 music，但 displayName 可能是 `Now Playing`（rawName==music）
- 展开状态下会显示 Mini Header + displayName='Now Playing'，造成“异常显示/突兀切换”更明显

### 1.4 修复方向建议

建议分为“短期稳定修复”和“长期机制优化”。

#### A. 自动收起策略（推荐作为短期稳定措施）

在检测到 block 类型从 `talk -> non-talk`（music/system）时，如果当前处于 expanded，应自动收起：
- 收敛用户感知：展开属于 talk 详情态，进入音乐应退出详情态
- 避免 layout 动画在树结构突变时发生

实现点：
- 在 `RadioPlayer` 或 `SubtitleDisplay` 中新增 effect：
  - 依赖 `currentLine` / `displayInfo.type`
  - 若 `isExpanded && displayInfo.type !== 'talk'` -> `onExpandChange(false)`

#### B. 改进 music/system 判定（必要）

把“音乐界面”判定从 `text.includes('music')` 改为更强的信号：
- 优先使用 `ScriptEvent.musicMeta` 或 `speaker==='music'`
- 对 system 文本（例如 `Playing: music`、`Jumping to: music`）应保持为 system，不要驱动音乐 UI

建议：
- 使用严格规则：
  - `if (currentLine.musicMeta || speaker === 'music') => music`
  - `else if speaker==='system' => system`
  - `else => talk`

#### C. 动画/布局：减少 layout 范围与稳定高度

- 避免在同一组件内多个 `layout` 叠加，尤其是条件渲染导致节点消失时
- 对展开区域可采用：
  - 固定容器高度 + 内部滚动（稳定布局）
  - 或使用 `AnimatePresence mode="wait"` 包裹 talk/music/system 主体，确保退出动画完成后再进入
- 检查 z-index 与 overflow：主卡片 `overflow-hidden` 对正在缩放/位移的内容易造成边缘裁切

---

## 问题 2：留言输入框手机窄屏适配问题（Send 按钮被挤出）

### 2.1 相关代码定位

- `src/widgets/radio-player/ui/MailboxDrawer.tsx`
  - 外层容器：`className="mt-6 w-full max-w-md mx-auto"`
  - 输入行：`className="relative flex items-center gap-2"`
  - 左侧 Sparkles：`<div className="pl-3 ...">`
  - input：`className="flex-1 ... py-3 px-2"`
  - 按钮组：`className="flex items-center gap-1.5 pr-1.5"`
  - 每个按钮：`p-2.5`（相当于 20px padding，总宽较大）

### 2.2 根因分析：宽度预算（窄屏下的“最小宽度”由内容决定）

在 flex row 下，整体宽度 = 左 padding + icon 固定宽 + gap + input + 按钮组最小宽 + right padding。

关键问题：
1) 按钮组的最小宽度很硬：
   - 2 个按钮，每个 `p-2.5` + 图标宽 + border/rounding
   - 即使 input 可以收缩，按钮组仍然占据较大固定宽度

2) 左侧 Sparkles 有 `pl-3`，同时输入本身 `px-2`，加上 container `p-1.5`，左右 padding 累积明显。

3) `max-w-md` 在移动端并不会直接导致溢出（因为还有 `w-full`），但它也不会提供任何“窄屏专属”的布局优化。

4) 缺少响应式断点：
   - 仍以桌面思路（横向一行）设计
   - 当屏幕宽度非常窄（例如 320px 或更小，或者在某些内嵌 WebView）时，row 布局无法容纳按钮组 + 输入框

### 2.3 渲染情况估算（以 320px viewport 为例）

粗略预算：
- 外层 `max-w-md` 不起作用，宽约 320
- 内层 `p-1.5` => 左右各 6px
- Sparkles：图标 16px + `pl-3`(12px) => ~28px（还未算自身容器）
- gap-2 => 8px
- 按钮组：
  - 每个按钮：padding 20px + icon 14px ≈ 34px
  - 两个按钮 + gap 6px + pr-1.5 6px => 34*2 + 6 + 6 = 80px
- 仅固定项合计：6 + 28 + 8 + 80 + 6 ≈ 128px
- 剩余给 input：320 - 128 = 192px

看似够用，但实际还存在：
- border/rounding、字体最小宽度、placeholder、以及 flex item 的 min-width 默认行为
- **关键点：flex 子项默认 `min-width: auto`**，会导致 input 不愿意进一步收缩，从而把按钮挤出容器。

在 Tailwind 中通常用 `min-w-0` 来允许 flex item 收缩。

### 2.4 响应式缺陷点列表

- input 缺少 `min-w-0`（典型窄屏溢出根因）
- 按钮 padding 偏大，且没有移动端缩小策略（如 `sm:` / `max-sm:`）
- layout 只有单行，没有在极窄屏下的堆叠（column）fallback

### 2.5 修复方向建议

#### A. 最小改动：允许输入框收缩（强烈推荐）

- 给 input 增加 `min-w-0`
- 给按钮组增加 `shrink-0`，避免按钮被压扁，同时让 input 承担收缩

#### B. 移动端缩小按钮尺寸

- 使用响应式：
  - `p-2` 或 `p-1.5` 在小屏
  - `text-xs` / 图标更小

#### C. 极窄屏堆叠布局（增强）

- 当屏幕很窄（例如 `max-[360px]`）将 `flex-row` 改为 `flex-col`：
  - 第一行：input
  - 第二行：Send + Close 按钮

---

## 问题 3：节目手动切换的多个关键问题

> 子问题：
> 1) 切换延迟
> 2) 错误标签显示（如 jumping to music 而非歌名）
> 3) 多人讲话/批量 TTS 台词同步不一致

### 3.1 手动切换链路（UI → Agent）

#### 3.1.1 UI 触发

- TimelinePanel 点击 block：
  - `src/widgets/radio-player/ui/TimelinePanel.tsx`
    - `onClick={() => !isHistory && onJumpToBlock(i)}`

- hook 计算 index 并调用 agent：
  - `src/widgets/radio-player/hooks/useRadioPlayer.ts`
    - `jumpToBlock(uiIndex)`
    - 校验 `targetBlock.isHistory` 不允许跳
    - 计算 `actualIndex`（过滤 history 后 findIndex）
    - 调用 `directorAgent.skipToBlock(actualIndex)`

#### 3.1.2 导演/播放控制

- `DirectorAgent.skipToBlock(index)` 委托给：
  - `src/features/agents/lib/playback-controller.ts` `skipToBlock(state,index)`

该方法做了：
- `state.skipRequested = true; state.targetBlockIndex = index;`
- 若 paused 则恢复
- `audioMixer.stopAll()`
- **立即 emit 一个系统脚本事件**：
  ```ts
  radioMonitor.emitScript('system', `Jumping to: ${targetBlock.type}`, targetBlock.id)
  ```

- 导演主循环 `executeTimeline()` 中：
  - 每轮先处理 skipRequested：
    - 直接设置 `currentBlockIndex = targetBlockIndex`
    - `await this.prepareBlocks(currentIndex, preloadCount)` 预备
  - 随后在执行 block 前会检查 prepared，不够会等待最多 10s（500ms 轮询）
  - block start 时也会 emit：`Playing: ${block.type}`（系统脚本）

### 3.2 子问题 1：切换延迟根因分析

#### 3.2.1 现象符合的代码路径

手动跳转后，会经历至少两段等待：
1) `audioMixer.stopAll()` 立即停止音频（同步）
2) `executeTimeline` 下一轮循环才会处理 `skipRequested`，并调用：
   - `await this.prepareBlocks(currentIndex, preloadCount)`
3) 如果目标 block 仍未准备好（prepare 耗时较长），会进入等待：
   - 最多等待 10s
   - 每 500ms 检查一次

这意味着延迟来源可能是：
- **prepareBlocks 本身的耗时**：
  - talk：TTS 生成（网络 + 合成）
  - music：搜索 + 获取 url + 预拉取/缓存（见 music executor / mixer 行为）
- **预加载策略与跳转相冲突**：
  - 系统通常只预加载从当前 index 往后 N 个
  - 跳转到“未预加载区域”就必须现场准备
- **循环轮询粒度**：即使准备很快，仍可能卡在 100~500ms 轮询 + js 事件循环

#### 3.2.2 额外可疑点：stopAll 与资源释放

`audioMixer.stopAll()` 很可能触发：
- Howler stop / unload
- AudioContext 节点断开

如果 stopAll 内部有异步清理或 fade（需查看 mixer 实现），也可能造成体感“停一下再播”。

#### 3.2.3 改进方向

- 跳转时应优先“只 prepare 目标 block”，而不是 `prepareBlocks(index, preloadCount)`（会额外准备多个 block，延长首播时间）。
- 或将 `prepareBlocks` 并行化后分为：
  - `await prepareBlock(index)` 作为首要
  - 其余 preload 放后台
- UI 层显示“正在准备目标节目”的明确 loading 状态（当前只通过 script 文本）

### 3.3 子问题 2：错误标签显示的根因（jumping to music / now playing）

#### 3.3.1 根因：手动跳转 emit 的脚本事件是“系统占位符”

`PlaybackController.skipToBlock` 立即 emit：
- `speaker='system'`
- `text='Jumping to: ${targetBlock.type}'`

与此同时，`SubtitleDisplay` 对 `text.includes('music')` 的宽松判定可能会把该 system 信息当作 music 显示；即便不当作 music，也会以 system 显示。

因此当目标为 music block：
- UI 很可能显示：
  - `displayName = 'Now Playing'`（如果走了 music 分支，rawName=...）
  - 或显示 `Jumping to: music`（system 分支）
- 而真实歌名需要等到音乐执行器 emitMusicScript 或至少 emitScript(speaker='music') 才会更新。

#### 3.3.2 TimelinePanel 的标签策略也会导致“歌名不对/不清晰”

- `src/widgets/radio-player/ui/TimelinePanel.tsx` `getBlockLabel`：
  - `music: return block.search;`

`block.search` 很可能是搜索关键词（如 “lofi chill”），不是最终命中的 trackName。
如果希望显示真实歌曲名，需要在 block 上填充 resolved track meta，或在播放过程中更新 timeline block 的 displayName。

#### 3.3.3 改进方向

- `skipToBlock` 的立即脚本事件不应驱动“音乐 UI”，更适合走专用的 `log` 或单独的 `script.type='system'`。
- 对 music：应该尽快 emitMusicScript（带 musicMeta）而不是 `Jumping to: music`。
  - 可能方式：在 music block prepare 完成（已拿到 track）后 emit。
- UI 音乐展示应只信任 `musicMeta` 或 `speaker==='music'`。

### 3.4 子问题 3：多人讲话与台词同步不一致（批量 TTS vs 单句 TTS）

#### 3.4.1 当前两种模式

- 单句模式（Microsoft 时代风格）：
  - 每句先 emitScript(speaker,text) 再播放该句音频
  - UI 能逐句、逐 speaker 更新

- Batched 模式（Gemini）：
  - `prepareTalkBlock` 的切换条件：
    - `settings.ttsProvider === 'gemini'`
    - `uniqueSpeakers.size <= 2`
    - `block.scripts.length >= 1`
  - `executeTalkBlock` 中，如果存在 batchAudioData：
    1) **先 for-loop emit 所有 scripts**
    2) 再 `await audioMixer.playVoice(batchAudioData)` 一次性播放

#### 3.4.2 根因：脚本事件粒度与音频粒度不匹配

Batched 模式下，事件与音频不对齐：
- emitScript 发生在音频播放之前且一次性全部 emit
- UI 订阅到 script 后会不断 setCurrentScript，最后停在“最后一句”
- 音频开始播放时，UI 已经显示最后一句/最后 speaker，导致：
  - “前端只显示部分台词/不完整”
  - “当前只显示一个 speaker，aa&bb 显示不出来”
  - “显示的台词是分割小段，不是提交给 TTS 的完整段落”（或者相反：音频是一段，台词却在 UI 里跳跃）

#### 3.4.3 speaker 显示能力不足

`ScriptEvent` 结构：
```ts
interface ScriptEvent { speaker: string; text: string; blockId: string; musicMeta?: ... }
```
- 只能表达一个 speaker
- UI `SubtitleDisplay` 也假定单 speaker：displayName = hostNames[speaker] || speaker
- 当文本希望表达“aa&bb”这类合说，需要：
  - speaker 字符串本身包含 `aa&bb`（当前 hostNames 不处理）
  - 或支持 `speakers: string[]`

#### 3.4.4 `radioMonitor.emitScript` 调用时机的关键问题

- 单句模式：emit 时机与播放几乎同步（每句播放前）
- Batched 模式：emit 时机在播放前“批量突发”，完全不同

这造成 UI “同步模型”不一致，且前端无法根据音频时间推进台词。

#### 3.4.5 改进方向：批量模式的台词显示策略

可选策略（从简单到复杂）：

**策略 1（最简单、最稳定）：batched 音频只 emit 一条“段落级” ScriptEvent**
- 将 block.scripts 合并为一个段落文本：
  - speaker：可以用 `"host1&host2"` 或 `"narration"`
  - text：拼接全部内容（含 speaker 标记）
- UI 展示完整段落，不再尝试逐句同步
- 优点：实现成本低、与批量音频一致
- 缺点：失去逐句动态效果

**策略 2（中等复杂）：batched 音频仍 emit 多条，但按时间调度 emit**
- 需要每句的时间戳（start/end）或至少估算
- 可能来源：
  - TTS 服务返回 word/segment timestamps（若 Gemini 支持）
  - 或用字数比例粗估（不准但可用）
- 在播放 batched 音频时设置一个 scheduler：
  - setTimeout / requestAnimationFrame
  - 在对应时间点 emitScript

**策略 3（架构性重构）：把“ScriptEvent”升级为“BlockPlaybackEvent”**
- 支持：
  - blockStart/blockEnd
  - scriptSegments with timestamps
  - 多 speaker
  - 当前播放 position
- UI 根据 position 驱动字幕

### 3.5 音频长度与台词显示时长的同步机制评估

当前系统：
- UI 没有“播放进度”概念
- 仅被动响应 script 事件

因此：
- 单句模式可近似同步（因为 emit 就在播放前）
- batched 模式无法同步（缺少时间锚点）

建议未来在 `audioMixer.playVoice` 层提供：
- onStart/onEnd 回调
- 或可查询 `currentTime/duration`
并在 monitor 层引入 `playbackProgress` 事件，用于精细字幕同步。

---

## 改进方向汇总（修改项清单 + 优先级）

### P0（高优先级：直接影响可用性/显示错乱）

1) **SubtitleDisplay：music 判定从“包含 music 文本”改为“musicMeta 或 speaker=music”**
   - 避免 `Jumping to: music`、`Playing: music` 驱动音乐 UI

2) **展开态切换到非 talk 时自动收起**
   - `isExpanded && displayInfo.type !== 'talk' => onExpandChange(false)`

3) **MailboxDrawer：input 增加 `min-w-0` + 按钮组 `shrink-0`**
   - 解决窄屏按钮被挤出

### P1（中优先级：体验与信息准确性）

4) **手动跳转时的 UI 文本改造**
   - 不要 emitScript("Jumping to: type") 作为主显示
   - 改为 log 或专用 event

5) **TimelinePanel music 标签改造**
   - `block.search` 更像关键词而不是歌名
   - 引入 resolved trackName/artist 并显示

### P2（架构性优化：字幕-音频同步一致性）

6) **统一台词粒度与音频粒度**
   - batched 模式建议先落地“段落级 ScriptEvent”
   - 或引入 timestamps + scheduler

7) **扩展 ScriptEvent 支持多 speaker/多段**
   - `speaker: string` -> `speakers: string[] | string`
   - `text` 支持数组 segments
   - UI 支持多 speaker 显示（如 header 显示 `A + B`，正文合并）

---

## 关键调用链路梳理（按票据要求）

- RadioMonitor emitScript 调用链：
  - `DirectorAgent.executeTimeline` blockStart -> emitScript('system', `Playing: ${type}`, blockId)
  - `PlaybackController.skipToBlock` -> emitScript('system', `Jumping to: ${type}`, targetBlock.id)
  - `TalkExecutor.executeTalkBlockSingle` -> 每句 emitScript + playVoice
  - `TalkExecutor.executeTalkBlock (batched)` -> 先批量 emitScript，再 playVoice(整段)

- jumpToBlock 完整链路：
  - UI TimelinePanel -> useRadioPlayer.jumpToBlock -> directorAgent.skipToBlock -> PlaybackController.skipToBlock
  - -> DirectorAgent.executeTimeline 下一轮处理 skipRequested -> prepare -> (可能等待准备完成) -> execute block

---

## 建议的下一步（落地顺序）

1) 先修复字幕判定 + 展开自动收起（问题1/3互相影响，且改动小，收益大）。
2) 修复 MailboxDrawer 的 `min-w-0` 与响应式按钮（问题2，低风险）。
3) 调整 skipToBlock 的“占位脚本事件”策略，避免影响 SubtitleDisplay（问题3-2）。
4) 规划 batched TTS 的字幕策略（段落级 or timestamps），并统一 UI 展示模型（问题3-3）。
