# Briefly Chrome Extension PoC

A Manifest V3 proof of concept for reading existing YouTube captions locally in the browser and passing them through `@briefly/core`.

## What works

- Detect the current YouTube video across SPA navigation
- Read caption track metadata from the YouTube player page context
- Fetch the selected caption track as YouTube `json3` timed text in the page context
- Convert `json3` to VTT and normalize it with `@briefly/core`
- Show a local transcript drawer with language selection and text search
- Click a timestamp to seek the current YouTube player
- Copy the cleaned transcript

No backend, account, AI model, audio download, or ASR service is used.

## Build

From the repository root:

```bash
pnpm install
pnpm build
pnpm test
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select:

```text
apps/extension/dist
```

## Architecture

The extension uses two MV3 content-script worlds:

- `page-bridge.js` runs in `MAIN` so it can read YouTube player globals and request the signed `captionTracks.baseUrl`.
- `content.js` runs in the default isolated extension world and owns the Briefly UI.

The two worlds communicate with narrowly-scoped `window.postMessage` messages. No secrets or privileged extension APIs are exposed to the page world.

`core.js` is copied from `packages/core/dist/index.js` at build time and dynamically imported by the isolated content script.

## PoC limitations

- Only videos with an existing YouTube caption track are supported.
- YouTube player internals are undocumented and can change; the source adapter is intentionally isolated from `@briefly/core`.
- The UI is an injected drawer rather than the final product design.
- No persistence or transcript cache is included yet.
