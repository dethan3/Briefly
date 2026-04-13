# Subtitle Briefing

[中文说明 / Chinese README](./README.zh-CN.md)

Subtitle Briefing is a reusable, agent-neutral skill package for turning long-form subtitles and transcripts into structured briefing documents.

It is designed for podcast interviews, panel discussions, technical talks, and political or business conversations where the raw source usually arrives as `.srt`, `.vtt`, `.txt`, or transcript exports.

## What It Does

- Normalizes raw subtitles before analysis
- Removes timestamps, cue numbers, and markup from model-facing text
- Preserves a traceable segment map in JSON
- Reconstructs fragmented dialogue into coherent arguments
- Extracts numeric signals, conflict lines, and actionable takeaways
- Produces briefing-ready Markdown summaries

## Why Normalize First

Raw subtitles are noisy:

- timestamps consume context
- line breaks split sentences unnaturally
- adjacent turns may be merged poorly
- many files do not include speaker labels

The normalizer converts those files into:

- `normalized/<basename>.clean.txt`
- `normalized/<basename>.segments.json`

`clean.txt` is the model-facing input.  
`segments.json` is the traceable sidecar for quotes, timestamps, and turn-level hints.

## Repository Layout

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

## Quick Start

1. Put subtitle or transcript files into `raw/`
2. Run:

```bash
python3 scripts/normalize_subtitles.py raw --output-dir normalized
```

3. Use `SKILL.md` plus `references/output-contract.md` to generate a summary into `summaries/`

## Core Inputs and Outputs

Input formats:

- `.srt`
- `.vtt`
- `.txt`
- `.md`
- optional `raw/<basename>.meta.json`

Output formats:

- `normalized/<basename>.clean.txt`
- `normalized/<basename>.segments.json`
- `summaries/<basename>.md`

## Speaker Attribution Reality

Pure subtitle files often do not contain reliable speaker names.

This repo therefore supports three attribution levels:

1. Explicit speaker labels  
   Best case. Use named speakers directly.
2. Turn-level inference  
   The normalizer detects explicit `>>` boundaries and adds `role_hint`, `turn_id`, and `explicit_turn`.
3. Viewpoint-level downgrade  
   When names are unavailable, summarize by `question / answer / interjection` or `supporting / opposing` viewpoint clusters.

Do not claim exact named attribution unless the source or metadata supports it.

## Optional Metadata

If needed, add `raw/<basename>.meta.json` to stabilize:

- title
- host names
- guest names
- primary guest
- aliases
- topic hint

See [references/meta-schema.md](./references/meta-schema.md).

## Agent Entry Points

This repo uses multiple entry files so different agent runtimes can consume the same skill package:

- [SKILL.md](./SKILL.md): canonical skill workflow
- [AGENTS.md](./AGENTS.md): generic project instructions for agents that look for `AGENTS.md`
- [CLAUDE.md](./CLAUDE.md): Claude Code entry file
- [GEMINI.md](./GEMINI.md): entry file for `GEMINI.md`-compatible runtimes
- [OPENCLAW.md](./OPENCLAW.md): explicit adapter for OpenClaw setups
- [.cursorrules](./.cursorrules): minimal Cursor-compatible repository instructions
- [agents/openai.yaml](./agents/openai.yaml): OpenAI skill UI metadata for skill-aware runtimes

The source of truth is still `SKILL.md` plus the files under `scripts/` and `references/`.

## Agent Integration

### Codex and other skill-aware agents

Use [SKILL.md](./SKILL.md) as the canonical entry.  
If the runtime supports repo-local skills, point it at this repository directly.

### Claude Code

Claude Code should use [CLAUDE.md](./CLAUDE.md) as the runtime entry file and `SKILL.md` as the workflow definition.

Typical setup:

```bash
git clone <this-repo> ~/.claude/skills/subtitle-briefing
```

### OpenClaw and other `AGENTS.md` runtimes

OpenClaw-style runtimes should use [AGENTS.md](./AGENTS.md) as the entry file and then follow `SKILL.md`.

Typical setup:

```bash
git clone <this-repo> /workspace/<channel>/skills/subtitle-briefing
```

### Gemini CLI and other `GEMINI.md` runtimes

Use [GEMINI.md](./GEMINI.md) as the runtime entry file, then follow `SKILL.md`.

### Cursor and other `.cursorrules` runtimes

Use [.cursorrules](./.cursorrules) as the repository instruction shim. It intentionally stays thin and points back to `SKILL.md`.

### OpenAI skill-aware runtimes

Use [agents/openai.yaml](./agents/openai.yaml) as the UI metadata layer and [SKILL.md](./SKILL.md) as the canonical workflow.

## Dependencies

Current normalizer requirements:

- Python 3
- standard library only

No virtual environment is required for the current implementation.

## Limitations

- No audio-based diarization yet
- No guaranteed person-level attribution from unlabeled subtitles
- No automatic external fact-checking for numbers quoted in transcripts

## Development Notes

- Keep repo-root docs agent-neutral
- Keep runtime-specific instructions thin and derivative
- Do not check user transcripts or generated summaries into version control by default
- `.gitignore` keeps `raw/`, `normalized/`, `summaries/`, and `artifacts/` clean while preserving the folder structure
