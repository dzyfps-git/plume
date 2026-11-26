// The design system comes first, so that a feature's own style can add to it.
import "./house/tokens.css";
import "./house/bundle.css";
import "./house/bundle.js";
import { render } from "solid-js/web";
import { appWindow, startState } from "./api";
import { App } from "./app/App";
import { follow } from "./live/store";
import { useSettings } from "./store";
import { followPaint } from "./ui/paint";
import "./app/app.css";
import "./ui/game.css";

const start = await startState();
await useSettings(start.settings);
await follow(start);
followPaint();
render(() => <App page={start.page} />, document.getElementById("root")!);
window.House.start();
await appWindow().show();
performance.mark("ready");
// Opened as the game started: it waits in the taskbar, and the game keeps the screen.
if (start.quiet) await appWindow().minimize();
else await appWindow().setFocus();
window.House.edge();
