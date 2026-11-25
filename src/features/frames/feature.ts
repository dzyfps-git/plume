import { near } from "../../live/store";
import type { Feature } from "../types";
import { FoeOverlay, PartyOverlay, TargetOverlay, YouOverlay } from "./Overlays";

export const you: Feature = {
  id: "you",
  name: "Your health",
  icon: "",
  overlay: {
    view: YouOverlay, group: "Health", about: "Your health and what is bad for you.", width: 260,
    place: { on: false, x: 0.3, y: 0.68, scale: 1 }, empty: () => !near.you || near.you.hp < 0,
  },
};
export const target: Feature = {
  id: "target",
  name: "Target",
  icon: "",
  overlay: {
    view: TargetOverlay, group: "Health", about: "The monster you hit last, with what is on it, yours first.", width: 260,
    place: { on: false, x: 0.7, y: 0.68, scale: 1 }, empty: () => !near.target,
  },
};
export const foe: Feature = {
  id: "foe",
  name: "Target player",
  icon: "",
  overlay: {
    view: FoeOverlay, group: "Health", about: "The player you fight, with what is on them. Gone 15 seconds after.", width: 260,
    place: { on: false, x: 0.7, y: 0.5, scale: 1 }, empty: () => !near.foe,
  },
};
export const party: Feature = {
  id: "party",
  name: "Party frames",
  icon: "",
  overlay: {
    view: PartyOverlay, group: "Health", about: "The party's health, debuffs, and your buffs on them.", width: 260,
    place: { on: false, x: 0, y: 0.4, scale: 1 }, empty: () => near.party.length < 2,
  },
};
