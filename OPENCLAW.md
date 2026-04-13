# OPENCLAW.md

This repo contains a reusable subtitle-briefing skill.

This file is the explicit OpenClaw-facing adapter. If your runtime already reads `AGENTS.md`, that file remains the primary generic entry point.

## Start Here

1. Read `AGENTS.md`
2. Read `SKILL.md`
3. Read `references/output-contract.md` when writing summaries

## Working Loop

1. Inspect `raw/`
2. Normalize first:

```bash
python3 scripts/normalize_subtitles.py raw --output-dir normalized
```

3. Use `normalized/<basename>.clean.txt` for primary analysis
4. Use `normalized/<basename>.segments.json` for quote recovery, time lookup, and turn hints
5. Write the final summary to `summaries/<basename>.md`

## Constraints

- Default summary language: Chinese
- Keep essential English terms when translation would reduce precision
- Reconstruct by logic, not by timestamp order
- Do not fabricate named speaker attribution
- If attribution is weak, summarize by viewpoint cluster instead
