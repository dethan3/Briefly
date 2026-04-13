# CLAUDE.md

This repo contains a reusable subtitle-briefing skill.

This file is the Claude Code runtime entry point.

## Start Here

Read `SKILL.md` first. It is the source of truth for workflow, output structure, and downgrade behavior.

## Working Loop

1. Inspect `raw/`
2. Normalize first:

```bash
python3 scripts/normalize_subtitles.py raw --output-dir normalized
```

3. Use `normalized/<basename>.clean.txt` for analysis
4. Use `normalized/<basename>.segments.json` to validate quotes and attribution hints
5. Write the final result to `summaries/<basename>.md`

## Important Constraints

- Do not analyze raw timestamp-heavy `.srt` directly unless the file is tiny
- Do not claim exact named speaker attribution unless the source or metadata supports it
- If speaker identity is unclear, summarize by question/answer or viewpoint clusters instead
- Follow `references/output-contract.md` for the final Markdown structure

## Related Files

- `SKILL.md`
- `references/output-contract.md`
- `references/meta-schema.md`
