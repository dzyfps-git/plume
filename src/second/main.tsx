import "../house/tokens.css";
import "../house/bundle.css";
import "../house/bundle.js";
import { render } from "solid-js/web";
import { appWindow, startState } from "../api";
import { followActions } from "../features/actions/store";
import { followFinish } from "../features/finish/Overlay";
import { followMeter } from "../features/meter/live";
import { follow } from "../live/store";
import { useSettings } from "../store";
import { followPaint } from "../ui/paint";
import "../ui/game.css";
import "./second.css";
import { SecondScreen } from "./Second";

const start = await startState();
await useSettings(start.settings, true);
await follow();
followPaint();
// What the parts need beside them. Sounds, voices and counts stay with the overlays, or they would come twice.
followMeter();
followActions();
followFinish();
render(() => <SecondScreen />, document.getElementById("root")!);
window.House.start();
await appWindow().show();
