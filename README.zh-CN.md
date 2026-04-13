# Subtitle Briefing

[English README](./README.md)

Subtitle Briefing 是一个通用、与具体平台无关的 Skill 项目，用来把长字幕和长文本转成结构化 briefing。

它适用于播客访谈、圆桌讨论、技术演讲，以及政治或商业对话。原始输入通常是 `.srt`、`.vtt`、`.txt` 或其他 transcript 导出文件。

## 它做什么

- 在分析前先标准化字幕
- 去掉时间戳、cue 编号和无关标记
- 保留可追溯的 JSON 分段映射
- 将碎片化对话重组为连贯论证
- 抽取数字信号、观点冲突和行动启发
- 产出 briefing 风格的 Markdown 总结

## 为什么要先清洗

原始字幕通常很脏：

- 时间戳浪费上下文
- 换行会把句子切碎
- 相邻 turn 容易被错误拼接
- 很多文件根本没有说话人标签

标准化脚本会把原始文件转换为：

- `normalized/<basename>.clean.txt`
- `normalized/<basename>.segments.json`

`clean.txt` 是给模型和 Agent 直接吃的主文本。  
`segments.json` 是做引用、时间回溯和 turn 提示的 sidecar 文件。

## 仓库结构

```text
.
├── .cursorrules
├── SKILL.md
├── AGENTS.md
├── CLAUDE.md
├── GEMINI.md
├── OPENCLAW.md
├── README.md
├── README.zh-CN.md
├── agents/
│   └── openai.yaml
├── scripts/
│   └── normalize_subtitles.py
├── references/
│   ├── output-contract.md
│   └── meta-schema.md
├── raw/
├── normalized/
├── summaries/
└── artifacts/
```

## 快速开始

1. 把字幕或 transcript 放进 `raw/`
2. 运行：

```bash
python3 scripts/normalize_subtitles.py raw --output-dir normalized
```

3. 按照 `SKILL.md` 和 `references/output-contract.md` 的约定，把最终总结写入 `summaries/`

## 输入与输出

输入支持：

- `.srt`
- `.vtt`
- `.txt`
- `.md`
- 可选 `raw/<basename>.meta.json`

输出包括：

- `normalized/<basename>.clean.txt`
- `normalized/<basename>.segments.json`
- `summaries/<basename>.md`

## 关于说话人归因

纯字幕文件经常没有可靠的 speaker name。

因此本项目支持 3 个归因层级：

1. 显式 speaker label  
   最理想，直接使用人名。
2. turn 级推断  
   标准化脚本会识别显式 `>>` 边界，并补充 `role_hint`、`turn_id`、`explicit_turn`。
3. 观点级降级  
   如果没有人名，则输出 `提问 / 回答 / 插话` 或 `支持方 / 反对方` 等观点簇。

如果原始字幕和元数据都不支持，就不要假装能精确到某个人。

## 可选元数据

如果需要增强归因和标题稳定性，可以加入 `raw/<basename>.meta.json`，用于提供：

- 标题
- 主持人名单
- 嘉宾名单
- 主嘉宾
- 别名
- 主题提示

格式见 [references/meta-schema.md](./references/meta-schema.md)。

## 其他 Agent 的入口

为了兼容不同 Agent 运行时，仓库提供了多种入口文件：

- [SKILL.md](./SKILL.md)：核心 Skill 工作流
- [AGENTS.md](./AGENTS.md)：适合读取 `AGENTS.md` 的通用 Agent
- [CLAUDE.md](./CLAUDE.md)：Claude Code 入口文件
- [GEMINI.md](./GEMINI.md)：适合读取 `GEMINI.md` 的运行时
- [OPENCLAW.md](./OPENCLAW.md)：给 OpenClaw 显式使用的适配入口
- [.cursorrules](./.cursorrules)：给 Cursor 类运行时使用的轻量仓库规则
- [agents/openai.yaml](./agents/openai.yaml)：给支持 OpenAI Skill 元数据的运行时使用

真正的 source of truth 仍然是 `SKILL.md` 以及 `scripts/`、`references/` 下的内容。

## 各 Agent 接入方式

### Codex 和其他支持 Skill 的 Agent

直接把 [SKILL.md](./SKILL.md) 当作主入口。  
如果运行时支持 repo-local skill，就直接指向当前仓库。

### Claude Code

Claude Code 使用 [CLAUDE.md](./CLAUDE.md) 作为运行时入口，`SKILL.md` 作为完整工作流定义。

常见安装方式：

```bash
git clone <this-repo> ~/.claude/skills/subtitle-briefing
```

### OpenClaw 和其他读取 `AGENTS.md` 的运行时

这类 Agent 用 [AGENTS.md](./AGENTS.md) 作为入口文件，再继续遵循 `SKILL.md`。

常见安装方式：

```bash
git clone <this-repo> /workspace/<channel>/skills/subtitle-briefing
```

### Gemini CLI 和其他读取 `GEMINI.md` 的运行时

这类 Agent 使用 [GEMINI.md](./GEMINI.md) 作为入口，再继续遵循 `SKILL.md`。

### Cursor 和其他读取 `.cursorrules` 的运行时

这类运行时使用 [.cursorrules](./.cursorrules) 作为轻量入口，它只保留最少规则，并统一回指 `SKILL.md`。

### 支持 OpenAI Skill 元数据的运行时

这类运行时使用 [agents/openai.yaml](./agents/openai.yaml) 做 UI 元数据层，核心工作流仍然看 [SKILL.md](./SKILL.md)。

## 依赖

当前标准化脚本只需要：

- Python 3
- Python 标准库

现阶段不需要虚拟环境。

## 当前限制

- 还没有接入音频 diarization
- 对无标签字幕无法保证人名级精准归因
- 对 transcript 中引用的数字还没有自动外部核验

## 开发约定

- 根目录文档保持 agent-neutral
- 运行时专属入口尽量保持轻量，不要复制核心规则
- 默认不把用户输入字幕和生成结果纳入版本控制
- `.gitignore` 已经忽略了 `raw/`、`normalized/`、`summaries/`、`artifacts/` 中的内容，同时保留目录结构
