# Plume

A companion app for AION 2 on Windows: a damage meter, boss health and timers, party and target frames, buffs and
debuffs, auras you build, alerts, fight reports, dungeon runs and timed training runs, as overlays over the game and as
pages of its own. The name is a placeholder.

Not made, approved or supported by NC. Made for private use.

## What it does not do

- It does not open, read or change the game, and does not look at the screen.
- It does not press keys or click for you. Its own keys come from Windows' `RegisterHotKey`; nothing is hooked.
- It opens no connection. There is no account, upload, ranking or player lookup.
- Other players' names and numbers stay in memory and are gone when it closes. Only your own part of a fight is saved,
  with everyone else as one sum.
- What is near you (health, effects, the player you fight) is never written down at all.
- It writes to the registry only when you turn on "Start with Windows": one line in your own `Run` key.
- A fight leaves it only when you save one: CSV, JSON or a picture, written into Downloads. CSV and JSON hold your own
  part alone. The picture numbers other players instead of naming them.

`scripts/safety.test.mjs` checks the first three over every source file, on every pull request.

This repository holds no code that reads game traffic. Live data comes from a separate program, which is not part of
it. Without that program the app opens, shows your history, and says live data is off.

## Build

Needs Node 24, Rust and WebView2.

```
npm ci
npm run tauri dev
```

| Command | Does |
|---|---|
| `npm run check` | checks types |
| `npm test` | runs every test, the safety ones too |
| `npm run build` | builds the pages into `dist`; run it once before `cargo` |
| `npm run tauri build` | makes the installer |
| `npm run bench` | measures the release build against `budgets.json` |
| `npm run tokens` | writes `src/house/tokens.css` from `tokens.json` |

`PLUME_ENGINE` is the path of the engine to run. `PLUME_REPLAY` is a recording for it to play.

## Where things are

| Folder | Holds |
|---|---|
| `src/features` | one folder a feature: page, overlay, logic, tests. `index.ts` lists them |
| `src/overlay` | the window over the game: places, edit mode, quick bar, when each overlay shows |
| `src/app` | the main window: menu, palette, settings |
| `src/live` | what the engine says. Features know only this |
| `src/store` | settings and their defaults |
| `src/api` | the only place the pages talk to Rust |
| `src/house` | the design system, not edited here |
| `src-tauri/src` | windows, keys, files, starting with Windows, and keeping the engine running |

To add a feature, make a folder with a `feature.ts` and add it to `src/features/index.ts`. It gets its menu entry,
overlay, switch and place by itself.

Your own sounds for alerts go into the `sounds` folder, which the Alerts page opens.

## Rights

Copyright (c) 2026 dzyfps. All rights reserved. No license is given to use, copy, change or share this code.

AION 2 and its names belong to NC Corporation.
