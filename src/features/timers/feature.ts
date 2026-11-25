import type { Feature } from "../types";
import { soon, TimersOverlay } from "./Overlay";
import { followVoice } from "./voice";

export const timers: Feature = {
  id: "timers",
  name: "Boss timers",
  icon: "\ue823",
  overlay: {
    view: TimersOverlay,
    about: "Big hits that are coming, from your own pulls. Choose them on the Bosses page.",
    width: 240,
    place: { on: true, x: 0.5, y: 0.28, scale: 1 },
    empty: () => soon().length === 0,
    beside: followVoice,
  },
};
