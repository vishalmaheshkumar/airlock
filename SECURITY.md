# Security Policy

Hush's core promise is that pages can't reach beyond the window — no downloads to disk, no file uploads, no pop-ups, no new windows. If you've found a way around any of those, please report it privately.

## How to report

Open a private vulnerability report on GitHub:

> **Repository → Security → Report a vulnerability**

Or email the maintainer at the address on their GitHub profile. Please include:

- The page or site that reproduces the issue (or a minimal HTML).
- Hush version (`package.json` → `version`) and OS.
- Steps to reproduce, and what should have happened.

Please do not open a public issue for a working exploit of the download/upload/popup protections — give us a chance to patch first.

## Scope

In scope:
- Pages that cause a file to be written outside Electron's own cache.
- Pages that read a local file (upload, drag-drop, `showOpenFilePicker`, hidden pickers, clipboard tricks that reach the filesystem).
- Pages that open a new window / popunder.
- Any Electron sandbox escape reachable from a loaded page.

Out of scope:
- Features we don't offer — password manager, extensions, download prompts, telemetry — because they don't exist here.
- Bugs in Chromium / Electron / Ghostery adblocker upstream (we'll ship their fix once released; please report those upstream).

## Timeline

Hush is a weekend project — expect a reply within a week. If the issue is severe, we'll ship a patch release the same week we confirm it.
