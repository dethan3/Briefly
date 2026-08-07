# Briefly

[中文说明 / Chinese README](./README.zh-CN.md)

**Turn long YouTube videos into clean, readable, searchable transcripts.**

Briefly is a browser-native transcript reader for long-form YouTube content such as podcasts, interviews, lectures, panels, and technical talks.

Instead of treating captions as a pile of timestamped fragments, Briefly cleans and restructures the existing YouTube transcript into something you can actually read, search, copy, and trace back to the original video.

> Current status: **Extension Alpha / integration validation**

The core and Chrome extension PoC are implemented. The next milestone is validating caption retrieval across real YouTube videos before building the public Web/SEO product.

## What Briefly Does Today

On a YouTube watch page, the Chrome extension can:

- Detect the current video, including YouTube SPA navigation
- Discover existing YouTube caption tracks
- Switch between available caption languages
- Fetch timed transcript data in the browser
- Normalize fragmented captions with `@briefly/core`
- Remove common caption noise and duplicate fragments
- Preserve timestamps and source traceability
- Search the cleaned transcript locally
- Click a timestamp to seek the current YouTube video
- Copy the cleaned transcript

No backend, account, AI model, audio download, or ASR service is required for the current transcript flow.

## Product Principle

Briefly is **Transcript First**, not AI First.

```text
YouTube video
    ↓
Existing captions
    ↓
Briefly Core
    ↓
Clean Transcript
    ↓
Read · Search · Jump · Copy
```

AI briefing, source-grounded summaries, and a public SEO site are planned later, after the basic transcript path is proven reliable.

## Install the Chrome Extension (Developer Alpha)

The extension is not yet published to the Chrome Web Store. Install it locally as an unpacked extension.

### Requirements

- Node.js 20+
- pnpm 10+
- Google Chrome or another Chromium browser with Manifest V3 support

### 1. Clone the repository

```bash
git clone https://github.com/dethan3/Briefly.git
cd Briefly
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Build and test

```bash
pnpm build
pnpm test
```

The extension build output is created at:

```text
apps/extension/dist
```

### 4. Load it into Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `apps/extension/dist`
5. Open a YouTube video that has captions

You should see a **Briefly** button near the bottom-right of the page.

## How to Use It

1. Open a YouTube video with manual or auto-generated captions.
2. Click **Briefly**.
3. Briefly reads the available caption tracks from the current YouTube player.
4. Select a language if multiple tracks are available.
5. Read the cleaned transcript in the right-side drawer.
6. Search for a word or phrase using the transcript search field.
7. Click a timestamp to jump the YouTube player to that point.
8. Click **Copy** to copy the cleaned transcript.

## Alpha Validation Checklist

Before treating the extension as a releasable product, validate it against real YouTube pages.

Recommended test cases:

- A video with manually uploaded captions
- A video with YouTube auto-generated captions
- A video with multiple caption languages
- A long podcast/interview (1+ hour)
- Switching from one YouTube video to another without a full page reload
- A video with no captions

For each case, verify:

- Caption tracks are detected
- The correct language is loaded
- Transcript text is not empty or obviously duplicated
- Search returns the expected segments
- Timestamp clicking seeks the current video
- Copy returns the cleaned transcript
- The extension recovers correctly after YouTube SPA navigation

## Architecture

Briefly is organized as a TypeScript-first monorepo.

```text
Briefly/
├── apps/
│   └── extension/          # Chrome MV3 extension PoC
├── packages/
│   └── core/               # Browser-native transcript engine
├── scripts/
│   └── normalize_subtitles.py  # Legacy/reference Python implementation
├── references/
├── SKILL.md
└── package.json
```

### `@briefly/core`

The core is intentionally runtime-agnostic:

- No network access
- No filesystem dependency
- No DOM dependency
- No runtime dependencies

It can run in:

- Chrome extensions
- Browser-side Web apps
- Node.js

Current responsibilities include:

- Parse SRT / VTT / TXT / Markdown transcripts
- Normalize caption text
- Remove common noise and leading fillers
- Deduplicate and merge fragmented cues
- Preserve timestamps and source indices
- Infer lightweight turn/role hints
- Search transcripts locally
- Export clean text, Markdown, and JSON

### YouTube Source Adapter

YouTube-specific logic is kept outside `@briefly/core`.

The extension uses two Manifest V3 execution worlds:

- `page-bridge.js` runs in `MAIN` to read YouTube player caption metadata and request the signed caption URL.
- `content.js` runs in the isolated extension world and owns the Briefly UI and transcript processing.

This keeps YouTube-specific, undocumented behavior isolated from the reusable transcript engine.

## Current Limitations

This is an Alpha, not a Chrome Web Store release.

- Only videos with an existing YouTube caption track are supported
- No audio transcription / Whisper fallback yet
- YouTube player internals are undocumented and may change
- Caption retrieval still needs broader real-browser validation
- The current side drawer is a functional PoC, not final product UI
- No transcript history or persistence yet
- No public Web/SEO application yet
- No AI Briefing UI yet

## Roadmap

### 1. Extension Alpha validation — **current**

Validate caption retrieval and Reader behavior across real YouTube videos.

### 2. Reader productization

Improve reading layout, loading/error states, search UX, original-vs-clean comparison, and export options.

### 3. Web / SEO tools

Build the public acquisition layer around low-cost tools such as:

- YouTube Transcript
- Subtitle Cleaner
- SRT to TXT
- VTT to TXT
- Remove Subtitle Timestamps

### 4. Source-grounded Briefing

Add optional AI briefing where claims link back to transcript segments and YouTube timestamps.

### 5. Chrome Web Store release

Package, polish, document privacy behavior, and publish the extension after real-world stability is proven.

## Legacy Subtitle Briefing Skill

Briefly started as an agent-neutral subtitle briefing Skill. That workflow is still retained for existing users and agent runtimes.

Relevant files:

- [SKILL.md](./SKILL.md)
- [AGENTS.md](./AGENTS.md)
- [CLAUDE.md](./CLAUDE.md)
- [GEMINI.md](./GEMINI.md)
- [OPENCLAW.md](./OPENCLAW.md)
- [references/output-contract.md](./references/output-contract.md)

The original Python normalizer also remains available:

```bash
python3 scripts/normalize_subtitles.py raw --output-dir normalized
```

It is currently kept as a reference implementation while the TypeScript core becomes the product source of truth.

## Development

Run all current builds and tests from the repository root:

```bash
pnpm install
pnpm build
pnpm test
```

Extension-specific documentation is available at [apps/extension/README.md](./apps/extension/README.md).

## License

A project license has not been finalized yet. Do not assume redistribution terms beyond what is explicitly provided in this repository.
