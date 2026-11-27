import type { Feature } from "../types";
import { BuffsOverlay, ControlOverlay, DebuffsOverlay, holds, lacks, PartyDebuffsOverlay, ReadyOverlay, sick, yourBuffs, yourDebuffs } from "./Overlays";

export const buffs: Feature = {
  id: "buffs",
  name: "Buffs",
  icon: "",
  overlay: {
    view: BuffsOverlay, group: "Effects", about: "Your buffs that run out, the soonest first.", width: 260,
    place: { on: false, x: 0.3, y: 0.82, scale: 1 }, empty: () => !yourBuffs().length,
  },
};
export const debuffs: Feature = {
  id: "debuffs",
  name: "Debuffs",
  icon: "",
  overlay: {
    view: DebuffsOverlay, group: "Effects", about: "What is bad for you.", width: 260,
    place: { on: false, x: 0.7, y: 0.82, scale: 1 }, empty: () => !yourDebuffs().length,
  },
};
export const partyDebuffs: Feature = {
  id: "partyDebuffs",
  name: "Party debuffs",
  icon: "",
  overlay: {
    view: PartyDebuffsOverlay, group: "Effects", about: "Who in the party has a debuff, and which.", width: 280,
    place: { on: false, x: 0, y: 0.85, scale: 1 }, empty: () => !sick().length,
  },
};
export const control: Feature = {
  id: "control",
  name: "Loss of control",
  icon: "",
  overlay: {
    view: ControlOverlay, group: "Effects", about: "What keeps you from acting, and for how long.", width: 240,
    place: { on: false, x: 0.5, y: 0.49, scale: 1 }, empty: () => !holds(),
  },
};
export const ready: Feature = {
  id: "ready",
  name: "Ready check",
  icon: "",
  overlay: {
    view: ReadyOverlay, group: "Effects", about: "Buffs and food you chose that are not on, out of fights. Choose them on the Auras page.", width: 320,
    place: { on: false, x: 0.25, y: 0.1, scale: 1 }, empty: () => !lacks().length,
  },
};
