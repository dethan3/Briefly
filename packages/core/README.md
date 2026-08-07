# @briefly/core

Browser-native transcript parsing and normalization for Briefly.

The package is intentionally runtime-agnostic: it has no network access, no filesystem access, no DOM dependency, and no runtime dependencies. It can be used from a Chrome extension, browser-side web code, or Node.js.

## Responsibilities

- Parse SRT and VTT captions
- Normalize plain text and Markdown transcripts
- Remove common caption noise and leading fillers
- Preserve source indices and timestamps
- Merge fragmented subtitle cues conservatively
- Preserve explicit speaker labels and infer turn-level role hints
- Produce a stable `TranscriptDocument`
- Search normalized transcript text locally
- Export clean text, Markdown, and JSON

## Compatibility

The existing `scripts/normalize_subtitles.py` remains in the repository as the legacy/reference implementation while the TypeScript core is adopted by the Web and extension surfaces.

The TypeScript segment fields intentionally retain the existing snake_case JSON names such as `speaker_guess`, `role_hint`, `turn_id`, and `source_indices` so existing Briefly workflows can migrate without a schema break.

## Build and test

```bash
pnpm install
pnpm --filter @briefly/core test
```
