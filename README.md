# Custom Browser

A minimal, privacy-focused desktop browser built with Electron.

## Features

- **Ad and tracker blocking** using [Ghostery's adblocker](https://github.com/ghostery/adblocker) (prebuilt ads + tracking lists, cached locally after first launch)
- **Pop-ups blocked**: pages can't open new windows
- **Downloads blocked**: no website can save files to disk
- **File uploads blocked**: file pickers are neutralized on every page
- Tabs, back/forward, reload, address bar and a custom new-tab page
- Context menu: open link in new tab, copy link address, reload, back
- Picture-in-picture button for videos

## Run

Requires Node.js.

```bash
npm install
npm start
```

## Structure

```
src/
  main.js       Main process: window, tabs, blocking, IPC
  preload.js    Bridge between the UI and the main process
  ui/           Toolbar, tab strip and new-tab page
```

## License

[MIT](LICENSE)
