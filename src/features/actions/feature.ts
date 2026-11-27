import type { Feature } from "../types";
import { ActionsOverlay, bar } from "./Overlay";
import { followActions } from "./store";

export const actions: Feature = {
  id: "actions",
  name: "Action bars",
  icon: "",
  overlay: {
    view: ActionsOverlay, group: "Effects", about: "About when your skills come back, learned from your own fights.", width: 300,
    place: { on: false, x: 0.5, y: 0.9, scale: 1 }, empty: () => !bar().length, beside: followActions,
  },
};
