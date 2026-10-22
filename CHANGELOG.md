# Changelog

All notable changes to Hush. Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semver.

## [0.2.0] — 2026-10-23

### Changed
- Project renamed from **Airlock** to **Hush**. New mark (four bars descending into a flat line) and sage-on-ink palette.
- Tab switching uses `view.setVisible` instead of zero bounds. Fixes a glitch where, with Picture-in-Picture running, switching tabs left the source page's layers visible under the active tab.

### Added
- **Audio indicator** on each tab: three bars that pulse while the page is making sound; click to mute (click again to unmute). The animation is suppressed under `prefers-reduced-motion`.
- **Native app packaging** via electron-builder: `npm run dist:mac|win|linux` builds `.dmg` / `.exe` / `.AppImage`. Config lives in `package.json`, icon at `build/icon.png`.
- **Release workflow** (`.github/workflows/release.yml`): pushing a `v*` tag builds all three OSes and uploads them to a GitHub Release.
- **Bookmarks** (`⌘D`) with a dedicated page (`⌘⇧B`) and a grid on the new-tab page.
- **History** (`⌘Y`) — last 1000 entries, stored locally, filterable, with "Clear all".
- **Find on page** (`⌘F`) with match count and prev/next navigation.
- **Zoom** (`⌘=` / `⌘-` / `⌘0`), per tab.
- **Tab drag-to-reorder** in the tab strip.
- **Keyboard shortcuts** for every action, via the application menu.
- **Light & dark themes** that follow `prefers-color-scheme`.
- **New-tab page** with search box, protection shields, and bookmarks grid.
- **URL helpers** extracted into `src/url.js`; `about:`, `mailto:`, `data:` and friends now pass through instead of hitting search.
- **Debounced key/value store** at `src/storage/store.js` for bookmarks and history.
- **Unit tests** for URL parsing and the store (`npm test`).
- **Smoke test** that launches Electron, waits for a ready marker, and quits (`npm run smoke`).
- **CI**: GitHub Actions runs unit tests on Linux / macOS / Windows across Node 20 and 22, plus a smoke launch on Linux under xvfb.
- **Repo scaffolding**: issue templates, PR template, `CONTRIBUTING.md`, `SECURITY.md`, `FUNDING.yml`, this changelog.

### Fixed
- Context menu now offers Copy when text is selected.
- Fullscreen video takeover also hides the find bar.

## [0.1.0] — Initial release (as Airlock)

- Minimal Electron browser with tabs, back/forward, reload, address bar.
- Ad & tracker blocking (Ghostery prebuilt lists, cached after first launch).
- Pop-ups, downloads, and file uploads blocked.
- Media shortcuts (space/`k`, arrows) for pages with no player of their own.
- Picture-in-picture button.
- HTML5-fullscreen takeover.
