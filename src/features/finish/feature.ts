import type { Feature } from "../types";
import { empty, FinishOverlay, followFinish } from "./Overlay";

export const finish: Feature = {
  id: "finish",
  name: "End of the fight",
  icon: "\ue734",
  overlay: {
    view: FinishOverlay, group: "Fight", about: "When a boss falls: who was the MVP, places 2 to 4, and whether it was your best. For some seconds.", width: 380,
    place: { on: true, x: 0.5, y: 0.04, scale: 1 }, empty, beside: followFinish,
  },
};
