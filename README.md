# Plume

A companion app for AION 2 on Windows: a damage meter, boss health and timers, party and target frames, buffs and
debuffs, auras you build, alerts, fight reports, dungeon runs and timed training runs, as overlays over the game, on a second
screen, and as pages of its own. It sets you against your own best. The name is a placeholder.

Not made, approved or supported by NC. Made for private use.

## What it does not do

- It does not open, read or change the game, and does not look at the screen.
- It does not press keys or click for you. Its own keys come from Windows' `RegisterHotKey`; nothing is hooked.
- Where the pointer is, is asked of Windows (`GetCursorPos`) only while the meter has buttons or is unlocked, to know
  when it is over them. Everywhere else, clicks go through to the game.
- It opens no connection. There is no account, upload, ranking or player lookup.
- Other players' names and numbers stay in memory and are gone when it closes. Only your own part of a fight is saved,
  with everyone else as one sum. The card at the end of a fight shows others' numbers for some seconds.
- What is near you (health, effects, the player you fight) and others' Combat Power are never written down at all.
- Your own PvP counts are kept on this PC, for six hours after the last one.
- It writes to the registry only when you turn on "Start with Windows": one line in your own `Run` key.
- The one exception is a recording of the session for a bug report, off until you turn it on: up to 256 MB of what the
  engine reads, with what other players did in it. It stays on this PC.
- A backup, made only when you ask, holds your settings and your own part of your fights.
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
| `src/overlay` | the window over the game: places, edit mode, panel, buttons that take the mouse, when each overlay shows |
| `src/second` | the window for a second screen, and what can stand on it |
| `src/app` | the main window: menu, palette, first start, the pages of settings |
| `src/live` | what the engine says. Features know only this |
| `src/store` | settings and their defaults |
| `src/api` | the only place the pages talk to Rust |
| `src/ui` | what pages and overlays share: lines, groups, the search over settings, colours, icons |
| `src/house` | the design system, not edited here |
| `src-tauri/src` | windows, keys, files, starting with Windows, and keeping the engine running |

To add a feature, make a folder with a `feature.ts` and add it to `src/features/index.ts`. It gets its menu entry,
overlay, switch and place by itself.

The game's pictures (skills, effects, classes, class art as `art_assassin.png` and so on, Combat Power, Kina, Odyle, tickets) are read from the `icons` folder in the
app's data, which Settings opens: `index.json` and PNG files. Letters and our own drawings stand in for those that are not
there. They belong to NC, so none are in this repository. `src/ui/icons.tsx` says which is for what. Each is drawn at the
exact size it has on the screen (`src/ui/Sharp.tsx`), and overlays are sized by layout with `--px` as one point of the
screen, so nothing is stretched and soft.

The MVP of a fight and the places are our own rule, `standing` in `src/features/report/deep.ts`: the share of the damage with buffs counted, up to
25 for healing that did something, up to 15 for stagger, less 10 for each death.

A grade is the share of your own other kills of that boss, with that class, that this one beat; for a training run, of the
runs of that length. It needs three others, and 100 is a new best. Your best kill, as the mark on the boss bar, is the
fastest of the same boss with about the same health. Both are in `src/features/best/logic.ts`. Nobody else's numbers are
in them.

Your own sounds for alerts go into the `sounds` folder, which the Alerts page opens.

## Rights

Copyright (c) 2026 dzyfps. All rights reserved. No license is given to use, copy, change or share this code.

AION 2 and its names belong to NC Corporation.
