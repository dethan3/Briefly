# AGENTS.md

This repository is a reusable subtitle-briefing skill package.

This file is the generic entry point for OpenClaw, Windsurf/Cascade-style runtimes, and any other agent that automatically reads `AGENTS.md`.

## Read Order

1. Read `SKILL.md`
2. Read `references/output-contract.md` when writing summaries
3. Read `references/meta-schema.md` only if a sidecar metadata file is needed

## Default Workflow

1. Look in `raw/` for subtitle or transcript files
2. Normalize them before analysis:

```bash
python3 scripts/normalize_subtitles.py raw --output-dir normalized
```

3. Use `normalized/<basename>.clean.txt` as the primary analysis input
4. Use `normalized/<basename>.segments.json` for traceability, quote recovery, turn hints, and timestamp lookup
5. Write final summaries to `summaries/<basename>.md`

## Output Rules

- Default summary language: Chinese
- Keep critical English technical terms when precision matters
- Reconstruct by logic, not by timestamp order
- Separate fact, forecast, and opinion
- Do not fabricate named speaker attribution

## Attribution Rules

- If the source includes explicit speaker labels, use them
- If the source only supports turn-level inference, rely on `role_hint`, `turn_id`, and `explicit_turn`
- If even that is weak, summarize by viewpoint clusters such as `question`, `answer`, `interjection`, `supporting view`, or `opposing view`

## Source of Truth

`SKILL.md` is the canonical workflow definition.  
This file is only a generic entry point for agent runtimes that automatically read `AGENTS.md`.
