# Sticky Wall

A desktop sticky note wall for Windows. Pull the wall from the right side of your screen and stick notes on it.

## Download

Get the latest version from the [Releases page](https://github.com/rmgirish/sticky-wall/releases):

| File | What it is |
| --- | --- |
| `Sticky Wall Setup X.Y.Z.exe` | Windows installer (wizard) — installs with Start Menu + desktop shortcut |
| `Sticky-Wall-Portable-X.Y.Z.exe` | Portable version — just run it, no install needed |
| `Sticky Wall-X.Y.Z-win.zip` | ZIP — extract anywhere and run `Sticky Wall.exe` |

Direct download (v1.0.3):

- [Installer](https://github.com/rmgirish/sticky-wall/releases/download/v1.0.3/Sticky%20Wall%20Setup%201.0.3.exe)
- [Portable](https://github.com/rmgirish/sticky-wall/releases/download/v1.0.3/Sticky-Wall-Portable-1.0.3.exe)
- [ZIP](https://github.com/rmgirish/sticky-wall/releases/download/v1.0.3/Sticky%20Wall-1.0.3-win.zip)

> Windows SmartScreen may warn "Windows protected your PC" because the app is not code-signed. Click **More info** → **Run anyway**. If the ZIP still won't run, right-click it → **Properties** → **Unblock**.

## How to use

1. Install or launch the app — a small pull tab appears at the right edge of your screen.
2. Click the tab (or hover near it) to open the wall.
3. Double-click the wall to create a note.
4. Drag notes around, click the pin to pin/unpin, right-click a note to change its color or delete it.
5. Use the search box (Ctrl+F) to find notes — click the `x` to clear the search.
6. The wall slides away when you click `‹` in the header. Re-open it from the tab or the tray icon.

Notes are saved automatically and survive restarts.

## Development

```bash
npm install
npm start        # run in dev mode
npm run dist     # build Windows installer + portable exe
```

## Requirements

- Windows 10 or 11
- No install needed for the portable version
