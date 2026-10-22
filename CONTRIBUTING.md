# Contributing to Hush

Thanks for your interest. Hush is a small project and intentionally stays that way — if you're thinking about adding something, please read [Non-goals](README.md#non-goals) first.

## Getting set up

```bash
git clone https://github.com/vishalmaheshkumar/hush.git
cd hush
npm install
npm start
```

Node 20 or newer, plus whatever Electron needs on your OS.

## Before you push

```bash
npm test       # unit tests on URL parsing + storage
npm run smoke  # Electron launches, loads new tab, prints a ready marker, quits
```

The smoke test needs a display. On Linux, run it under `xvfb-run` (see [ci.yml](.github/workflows/ci.yml)).

## What's in-scope

- Bugs in blocking (an ad slips through, a popup fires, a page downloads something)
- Keyboard-shortcut regressions
- Rendering issues in the toolbar or new tab
- Light-/dark-theme polish
- Smaller test-coverage gaps

## What's out-of-scope (please don't)

- Any feature that gives pages new reach — extensions, downloads with "trusted sites" lists, upload opt-in, password save, autofill, telemetry.
- A settings page with toggles for the four protections. If you need to turn those off, Hush is not the right browser.
- Account-sync, cloud bookmarks, "accounts" of any kind.

## Code shape

- Keep `main.js` the single source of truth for anything the main process does; the toolbar + internal pages reach it only through the narrow preloads.
- `src/url.js` and `src/storage/store.js` are pure modules — add tests for anything you change there.
- UI pages use CSS variables declared in `styles.css` / `internal.css`. New colors go in those files, not inline.

## Pull requests

- One topic per PR.
- Describe what a user will see change.
- If the change is user-visible, update the README's keyboard-shortcut table or feature list.
- Keep commits readable; squash the "fix typo" ones.

## Reporting a security issue

See [SECURITY.md](SECURITY.md).
