import { fight } from "../../live/store";
import type { Feature } from "../types";
import { BossOverlay } from "./Overlay";

export const boss: Feature = {
  id: "boss",
  name: "Boss health",
  icon: "",
  overlay: {
    view: BossOverlay,
    about: "The boss's health, how long until it falls, and its stagger gauge.",
    width: 420,
    place: { on: false, x: 0.5, y: 0.1, scale: 1 },
    empty: () => fight.target.maxHp <= 0,
  },
};
