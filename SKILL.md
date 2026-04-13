---
name: subtitle-briefing
description: Summarize raw subtitle and transcript files such as `.srt`, `.vtt`, `.txt`, and interview transcripts into structured briefing documents. Use when an agent needs to process long-form podcasts, interviews, technical talks, or panel discussions stored in `raw/`, especially when timestamps, fragmented captions, multi-speaker debate, hard numbers, and actionable insights must be reconstructed into a coherent summary.
---

# Subtitle Briefing

## Overview

Turn messy subtitle files into reusable briefing documents. Prefer a two-stage workflow: normalize subtitle text first, then synthesize the briefing from the cleaned text plus the traceable segment map.

This repository is the source of truth for the skill. Keep the core workflow agent-neutral so Codex, Claude Code, OpenClaw, and other agents can all consume the same `SKILL.md`, `scripts/`, and `references/`.

## Workflow

1. Inspect `raw/` for `.srt`, `.vtt`, `.txt`, or `.md` inputs. Also look for optional `raw/<basename>.meta.json`.
2. Normalize the transcript before summarizing. Do not feed raw timestamp-heavy subtitles directly into the model unless the file is tiny.
3. Read `normalized/<basename>.clean.txt` for the main analysis and `normalized/<basename>.segments.json` when quotes, timestamps, or attribution need verification.
4. Write the final briefing to `summaries/<basename>.md`.
5. Keep summaries high-signal and non-promotional. Reconstruct arguments by logic, not by subtitle order.

## Input Conventions

- Assume the repo root contains `raw/`, `normalized/`, `summaries/`, and optionally `artifacts/`.
- Prefer one summary per source subtitle file.
- If `raw/<basename>.meta.json` exists, use it to stabilize title, date, speaker names, aliases, and topic hints.
- If multiple subtitle files belong to one episode, merge only when filenames and metadata make that relationship explicit.

## Normalize First

Use the bundled script from the repo root:

```bash
python3 scripts/normalize_subtitles.py raw --output-dir normalized
```

The script:

- strips cue numbers, timestamps, and markup from the model-facing text
- merges fragmented caption lines into paragraph-like segments
- splits explicit `>>` speaker-turn markers into separate turns instead of letting host and guest lines merge together
- preserves speaker labels when they can be inferred
- adds `role_hint`, `speaker_guess`, and `explicit_turn` metadata to `segments.json` for downstream agents
- removes obvious duplicate cues and low-value noise
- writes a clean text file plus a JSON segment map for traceability

If the user gives a single file instead of a `raw/` directory, pass that path directly to the script.

## Summarization Rules

- Default output language is Chinese unless the user asks otherwise.
- Keep essential English technical terms when translation would reduce precision.
- Treat semantic reconstruction as the default behavior, not a visible section heading.
- Ignore ads, housekeeping, repeated banter, and filler unless they materially affect the argument.
- Separate fact, forecast, and opinion. Do not blur them together.
- Do not invent speaker attribution. If speaker identity is ambiguous, downgrade to viewpoint clusters.

## Required Sections

Use the Markdown contract in [references/output-contract.md](references/output-contract.md). The final briefing must include:

- `核心议题`
- `论证主线`
- `立场对垒` or `关键判断与隐含假设` for single-speaker material
- `硬核数据`
- `GSD 行动点`
- `金句库`
- `不确定项`
- `一句话结论`

## Quote and Attribution Rules

- Only quote lines that are supported by `segments.json`.
- Prefer short, high-insight quotes over long polished rewrites.
- If a quote is cleaned for readability, preserve meaning and do not add claims that were not said.
- Include speaker and time range when available.
- If `segments.json` includes `speaker_guess` or `role_hint`, treat them as hints rather than ground truth.
- If attribution is weak, say so explicitly.

## Degraded Cases

When subtitle quality is weak, keep the summary useful instead of pretending certainty.

- No speaker labels: summarize as `支持方观点`, `反对方观点`, `主持人追问`, or similar clusters.
- Single-speaker talk: replace `立场对垒` with `关键判断与隐含假设`.
- Very noisy OCR or ASR: output only high-confidence findings and call out uncertainty.
- Mixed-language subtitles: summarize in the requested language, but preserve critical original terms and names.
- Multiple unrelated files in `raw/`: process them separately unless the user explicitly asks for a combined briefing.

## Output Locations

- Write cleaned artifacts to `normalized/`.
- Write final summaries to `summaries/`.
- Use `artifacts/` only for optional side outputs such as extracted numeric tables or manual QA notes.

## Agent Portability

- Keep the core skill logic in this repo, not in a platform-specific home directory.
- Use relative paths such as `scripts/normalize_subtitles.py` and `references/output-contract.md`.
- If a platform needs its own adapter or manifest, generate it from this repo instead of editing the canonical workflow elsewhere.

## References

- For the Markdown output schema and section-level writing rules, read [references/output-contract.md](references/output-contract.md).
- For the optional metadata sidecar format, read [references/meta-schema.md](references/meta-schema.md).
