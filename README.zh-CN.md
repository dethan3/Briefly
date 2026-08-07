# Briefly

[English README](./README.md)

**把长 YouTube 视频变成干净、可读、可搜索、可回溯的 Transcript。**

Briefly 是一个面向长视频内容的浏览器原生 Transcript Reader，主要适用于 Podcast、人物访谈、课程、圆桌讨论和技术演讲。

它不是简单把 YouTube 字幕原样展示出来，而是把碎片化、重复、难阅读的 Caption 清洗成真正适合阅读的 Transcript，并保留时间戳，让用户可以随时跳回原视频核对。

> 当前状态：**Extension Alpha / 集成验收阶段**

核心能力和 Chrome 扩展 PoC 已经完成。下一阶段先验证真实 YouTube 视频上的字幕获取稳定性，再进入公开 Web / SEO 产品开发。

## 现在已经能做什么

在 YouTube 视频页面中，Chrome 扩展目前可以：

- 自动识别当前视频，包括 YouTube SPA 页面切换
- 发现当前视频已有的字幕轨道
- 在多语言字幕之间切换
- 直接在浏览器中获取带时间信息的 Transcript
- 使用 `@briefly/core` 清洗碎片字幕
- 去除常见字幕噪音和重复片段
- 保留时间戳和 source traceability
- 在本地搜索清洗后的 Transcript
- 点击时间戳直接跳转当前 YouTube 视频
- 一键复制 Clean Transcript

当前主链路**不需要后端、账号、AI 模型、音频下载或 ASR 服务**。

## 产品原则

Briefly 是 **Transcript First**，不是 AI First。

```text
YouTube Video
    ↓
已有字幕
    ↓
Briefly Core
    ↓
Clean Transcript
    ↓
阅读 · 搜索 · 跳转 · 复制
```

AI Briefing、带来源引用的总结和公开 SEO 网站都放在后续阶段。先把最基础的字幕获取和阅读体验验证稳定。

## 安装 Chrome 扩展（开发版 Alpha）

目前扩展还没有发布到 Chrome Web Store，需要以 Unpacked Extension 方式本地安装。

### 环境要求

- Node.js 20+
- pnpm 10+
- Google Chrome 或其他支持 Manifest V3 的 Chromium 浏览器

### 1. Clone 仓库

```bash
git clone https://github.com/dethan3/Briefly.git
cd Briefly
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 构建并运行测试

```bash
pnpm build
pnpm test
```

构建后的扩展目录位于：

```text
apps/extension/dist
```

### 4. 加载到 Chrome

1. 打开 `chrome://extensions`
2. 开启右上角 **开发者模式 / Developer mode**
3. 点击 **加载已解压的扩展程序 / Load unpacked**
4. 选择 `apps/extension/dist`
5. 打开一个带字幕的 YouTube 视频

正常情况下，页面右下角会出现一个 **Briefly** 按钮。

## 怎么使用

1. 打开一个有人工字幕或 YouTube 自动字幕的视频。
2. 点击右下角 **Briefly**。
3. Briefly 会读取当前 YouTube Player 可用的字幕轨道。
4. 如果存在多种语言，可以选择字幕语言。
5. 右侧 Reader 会显示清洗后的 Transcript。
6. 在 Search 输入框中搜索关键词或短语。
7. 点击任意时间戳，YouTube 播放器会直接跳到对应位置。
8. 点击 **Copy** 可以复制完整 Clean Transcript。

## Alpha 验收清单

在把它当成可发布产品之前，先用真实 YouTube 视频完成一轮验收。

建议至少测试：

- 有人工上传字幕的视频
- 有 YouTube 自动字幕的视频
- 有多语言字幕的视频
- 1 小时以上的 Podcast / Interview
- 不刷新页面，从一个 YouTube 视频切换到另一个视频
- 完全没有字幕的视频

每种场景重点验证：

- 是否正确检测字幕轨道
- 是否正确加载选择的语言
- Transcript 是否为空或出现明显重复
- Search 是否能定位正确片段
- 点击时间戳是否能正确 seek 视频
- Copy 是否复制的是 Clean Transcript
- YouTube SPA 切换视频后扩展能否重新工作

## 架构

Briefly 现在已经转为 TypeScript-first monorepo。

```text
Briefly/
├── apps/
│   └── extension/          # Chrome MV3 Extension PoC
├── packages/
│   └── core/               # 浏览器原生 Transcript Engine
├── scripts/
│   └── normalize_subtitles.py  # 旧 Python / Reference 实现
├── references/
├── SKILL.md
└── package.json
```

### `@briefly/core`

Core 被刻意设计成与运行环境无关：

- 不访问网络
- 不依赖文件系统
- 不依赖 DOM
- 没有 runtime dependencies

因此同一份 Core 可以运行在：

- Chrome Extension
- 浏览器端 Web App
- Node.js

当前 Core 负责：

- 解析 SRT / VTT / TXT / Markdown
- 清洗字幕文字
- 去除常见噪音和 leading fillers
- 去重和合并碎片 cue
- 保留 timestamp 与 source indices
- 做轻量 speaker / turn role hint
- 本地 Transcript Search
- 导出 Clean Text、Markdown 和 JSON

### YouTube Source Adapter

YouTube 特有逻辑不会写进 `@briefly/core`。

扩展使用两个 Manifest V3 execution world：

- `page-bridge.js` 运行在 `MAIN` world，读取 YouTube Player 的字幕元数据和 signed caption URL。
- `content.js` 运行在 isolated extension world，负责 Briefly UI 和 Transcript 处理。

这样即使以后 YouTube 内部实现发生变化，也只需要修改 Source Adapter，不会破坏 Core。

## 当前限制

现在还是 Alpha，不是 Chrome Web Store 正式版本。

- 目前只支持已有 YouTube Caption Track 的视频
- 还没有音频转写 / Whisper fallback
- YouTube Player 内部接口没有官方稳定保证，后续可能变化
- Caption 获取还需要更广泛的真实浏览器验证
- 当前右侧 Drawer 只是功能 PoC，不是最终 UI
- 没有 Transcript 历史记录和持久化
- 还没有公开 Web / SEO 应用
- 还没有 AI Briefing UI

## Roadmap

### 1. Extension Alpha 验收 —— **当前阶段**

验证不同真实 YouTube 视频上的 Caption 获取和 Reader 行为。

### 2. Reader 产品化

优化阅读排版、Loading/Error State、搜索体验、Original / Clean 对比和更多导出能力。

### 3. Web / SEO Tools

再建设公开获客层，优先围绕近零边际成本工具：

- YouTube Transcript
- Subtitle Cleaner
- SRT to TXT
- VTT to TXT
- Remove Subtitle Timestamps

### 4. Source-grounded Briefing

加入可选 AI Briefing，但每条重要结论都能够追溯到 Transcript Segment 和 YouTube Timestamp。

### 5. Chrome Web Store 发布

等真实使用稳定以后，再完善 UI、隐私说明、发布材料并提交 Chrome Web Store。

## 原来的 Subtitle Briefing Skill

Briefly 最初是一个 Agent-neutral Subtitle Briefing Skill，这套能力仍然保留，不会删除。

相关文件：

- [SKILL.md](./SKILL.md)
- [AGENTS.md](./AGENTS.md)
- [CLAUDE.md](./CLAUDE.md)
- [GEMINI.md](./GEMINI.md)
- [OPENCLAW.md](./OPENCLAW.md)
- [references/output-contract.md](./references/output-contract.md)

旧 Python Normalizer 也仍然可以使用：

```bash
python3 scripts/normalize_subtitles.py raw --output-dir normalized
```

现阶段它作为 Reference Implementation 保留，产品主实现逐步迁移到 TypeScript `@briefly/core`。

## 开发

从仓库根目录运行：

```bash
pnpm install
pnpm build
pnpm test
```

扩展的详细开发说明见 [apps/extension/README.md](./apps/extension/README.md)。

## License

项目 License 目前还没有最终确定。在仓库明确提供 License 之前，不应默认存在额外的再分发授权。
