import type { Feature } from "../types";
import { bare, SplitsOverlay } from "./Overlay";

export const splits: Feature = {
  id: "splits",
  name: "Run splits",
  icon: "\ue916",
  overlay: {
    view: SplitsOverlay, group: "Fight", about: "When each boss of a dungeon run fell, against your best run of that dungeon.", width: 230,
    place: { on: false, x: 0, y: 0.64, scale: 1 }, empty: bare,
  },
};
