# GEMINI.md

This repo contains a reusable subtitle-briefing skill.

This file is the entry point for Gemini CLI and other runtimes that look for `GEMINI.md`.

## Start Here

Read `SKILL.md` first. It is the canonical workflow and output contract source.

## Working Loop

1. Inspect `raw/`
2. Normalize first:

```bash
python3 scripts/normalize_subtitles.py raw --output-dir normalized
```

3. Use `normalized/<basename>.clean.txt` for primary analysis
4. Use `normalized/<basename>.segments.json` for quotes, timestamps, and attribution hints
5. Write the final summary to `summaries/<basename>.md`

## Constraints

- Default summary language: Chinese
- Reconstruct by logic, not subtitle order
- Separate fact, forecast, and opinion
- Do not claim exact named speaker attribution unless the source or metadata supports it
- Follow `references/output-contract.md` for the final Markdown structure

## Related Files

- `SKILL.md`
- `references/output-contract.md`
- `references/meta-schema.md`
