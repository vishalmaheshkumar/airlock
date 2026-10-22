<div align="center">

<img src="src/ui/assets/mark.svg" width="72" height="72" alt="Hush" />

# hush

**A quieter browser.** Hush seals pages off from the rest of the web — and from your machine. Ads, trackers, pop-ups, downloads and uploads are blocked. There is no telemetry, no account, no sync, no "experiments" page. Just a window.

[![Download](https://img.shields.io/github/v/release/vishalmaheshkumar/hush?include_prereleases&label=download&color=6b9080)](https://github.com/vishalmaheshkumar/hush/releases/latest)
[![CI](https://github.com/vishalmaheshkumar/hush/actions/workflows/ci.yml/badge.svg)](https://github.com/vishalmaheshkumar/hush/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-6b9080.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/electron-44-6b9080.svg)](https://www.electronjs.org/)
[![Node ≥ 20](https://img.shields.io/badge/node-%E2%89%A520-6b9080.svg)](https://nodejs.org/)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-6b9080.svg)

</div>

---

## Why

Browsers have gotten loud. Hush is for the times you want a window that just renders a page — not a platform that negotiates with the page, downloads things on its behalf, prompts you to sign in, or quietly carries work out of the window and into your filesystem. Reading mode for the whole browser.

## What's blocked, by default

| | What it does |
|---|---|
| **Ads & trackers** | Prebuilt Ghostery lists, cached locally after first launch |
| **Pop-ups & new windows** | `window.open`, `target="_blank"`, popunders — all denied |
| **Downloads** | Every `will-download` is cancelled before a byte hits disk |
| **File uploads** | File pickers, drag-drop, `showOpenFilePicker`, hidden `<input type="file">` — all neutralized on every page |

Hush doesn't ship a toggle to turn these off. If you need to upload or download, use a different browser — that is the point.

## Features

- **Tabs** with drag-to-reorder, loading spinner, and an audio indicator that pulses in time with sound playing on the page (click to mute)
- **Address bar** that routes URLs to the site and plain text to DuckDuckGo
- **Bookmarks** (⌘D) — appear on the new-tab page
- **History** (⌘Y) — a quiet list, local-only, 1000 most-recent entries
- **Find on page** (⌘F) with match count and prev/next
- **Zoom** (⌘= / ⌘- / ⌘0), per-tab
- **Picture-in-picture** on the most prominent `<video>`
- **Brain** — a local small-language-model chat panel next to the toolbar. Pick a model (10 supported, see below), it downloads once, then runs entirely on your machine via WebGPU — no cloud calls, no API keys, no account
- **Media shortcuts** for pages with no player of their own: space/`k` to toggle, arrows to seek and change volume. Backs off when a site handles the key itself (so YouTube stays in charge).
- **Fullscreen takeover** — a video that goes fullscreen covers the whole window, toolbar hidden
- **Light & dark themes** that follow your system

## Keyboard shortcuts

| Action | macOS | Windows / Linux |
|---|---|---|
| New tab | ⌘T | Ctrl T |
| Close tab | ⌘W | Ctrl W |
| Focus address bar | ⌘L | Ctrl L |
| Reload | ⌘R | Ctrl R |
| Back / Forward | ⌘[ / ⌘] | Ctrl [ / Ctrl ] |
| Next / Previous tab | ⌘⌥→ / ⌘⌥← | Ctrl Alt → / ← |
| Find on page | ⌘F | Ctrl F |
| Zoom in / out / reset | ⌘= / ⌘- / ⌘0 | Ctrl = / Ctrl - / Ctrl 0 |
| Bookmark page | ⌘D | Ctrl D |
| Show bookmarks | ⌘⇧B | Ctrl Shift B |
| Show history | ⌘Y | Ctrl Y |
| Toggle Brain panel | ⌘⇧L | Ctrl Shift L |

## Brain — local SLMs in-browser

Click the brain button next to **PiP** (or press ⌘⇧L) to open the chat panel. Pick a model from the list, hit **Load** — on first use it downloads the weights from the Hugging Face CDN and caches them in your browser's IndexedDB. Nothing afterwards leaves your machine.

| Model | Size | Good for |
|---|---|---|
| SmolLM2 · 135M | ≈100 MB | Pleasant short replies on anything — even a laptop with no GPU |
| SmolLM2 · 360M | ≈270 MB | Noticeably sharper than 135M, still fast |
| Qwen 2.5 · 0.5B | ≈380 MB | Strong instruction-following at a tiny size |
| Llama 3.2 · 1B | ≈800 MB | Meta's small chat model |
| SmolLM2 · 1.7B | ≈1.1 GB | HuggingFace's upper SmolLM tier |
| Qwen 2.5 · 1.5B | ≈1.0 GB | Solid general-purpose |
| Gemma 2 · 2B | ≈1.6 GB | Google's open small chat model |
| Llama 3.2 · 3B | ≈2.0 GB | Mid-tier, strong Q&A |
| Qwen 2.5 · 3B | ≈2.0 GB | Strong reasoning at this size |
| Phi-3.5 Mini · 3.8B | ≈2.4 GB | Microsoft's small-but-mighty reasoning model |

**Requires WebGPU** (Chromium 113+, which Hush's Electron satisfies). Models stay in your profile; `Reset conversation` clears the chat but keeps the loaded weights.

> About the downloads: this is a user-initiated model fetch, not a web page writing to your disk. Pages the browser is loading still can't download anything — those protections are unchanged.

## Download

Grab the latest build from the **[Releases page](https://github.com/vishalmaheshkumar/hush/releases/latest)**.

| OS | File |
|---|---|
| **macOS** (Apple Silicon or Intel) | `Hush-*-arm64.dmg` / `Hush-*.dmg` |
| **Windows** 10/11 | `Hush Setup *.exe` (installer) or `Hush *.exe` (portable) |
| **Linux** | `Hush-*.AppImage` or `hush_*.deb` |

Releases are self-signed. On macOS, right-click `Hush.app` → **Open** the first time (or run `xattr -dr com.apple.quarantine /Applications/Hush.app`). On Windows, click **More info → Run anyway** in the SmartScreen dialog. On Linux, `chmod +x Hush-*.AppImage` and double-click.

The first launch downloads the Ghostery adblocker filter lists; after that everything is cached in your user-data directory. Nothing else is sent anywhere.

## Build from source

Requires **Node.js ≥ 20**.

```bash
git clone https://github.com/vishalmaheshkumar/hush.git
cd hush
npm install
npm start           # run from source
npm run dist:mac    # build a .dmg into out/
npm run dist:win    # build a Windows installer
npm run dist:linux  # build an AppImage + .deb
```

## Project layout

```
src/
  main.js              Electron main process: window, tabs, blocking, IPC, menu
  url.js               URL normalization — see tests
  preload.js           Toolbar bridge (narrow API to the main process)
  internal-preload.js  Preload for file:// pages (newtab, bookmarks, history)
  ui/brain-preload.js  Preload for the Brain panel
  storage/store.js     Debounced JSON key/value store, used for bookmarks + history
  ui/
    index.html         Toolbar + tab strip
    renderer.js        Toolbar renderer
    newtab.html        New tab page (bookmarks grid + search)
    bookmarks.html     ⌘⇧B page
    history.html       ⌘Y page
    find.html          Find-in-page overlay
    brain.html / .js / .css   Local-SLM chat panel (loads @mlc-ai/web-llm)
    styles.css         Palette, tabs, toolbar
    internal.css       Palette for internal pages
    assets/            Logo, mark
test/
  url.test.js          Unit tests
  store.test.js        Unit tests
  smoke.js             Launches Electron, waits for ready marker, quits
.github/workflows/     CI (unit on 3 OSes × 2 node versions, smoke under xvfb)
```

## Testing

```bash
npm test       # unit tests (fast, no Electron)
npm run smoke  # launches Electron and waits for ready marker; needs a display or xvfb on Linux
```

CI runs the unit tests on Linux + macOS + Windows across Node 20 and 22, and the smoke test on Linux under xvfb — see [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Design

Hush aims for the feel of a reading room: ink on the dark side, warm paper on the light. Sage `#6b9080` is the single accent — it marks what's active and what's bookmarked, and nothing else. Headings use a transitional serif (Iowan / Charter / Georgia) to break the usual tech-UI feel; the rest is a plain system sans. The mark is four vertical bars that step down into a flat line — sound dropping to silence.

## Non-goals

- Extensions / add-ons
- Account sync
- Password manager
- Download or upload "modes" for web pages (Brain's **user-initiated** model fetch is deliberately not covered here — pages themselves still can't write anywhere)
- Telemetry
- Cloud-hosted AI calls — Brain only talks to models running on your own machine

## Contributing

Issues and small PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Please run `npm test` before pushing.

## Security

If you find a way for a page to leak a file in or out of Hush, please read [SECURITY.md](SECURITY.md) before filing a public issue.

## License

[MIT](LICENSE)
