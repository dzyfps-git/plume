import { near } from "../../live/store";
import { settings } from "../../store";
import { place } from "../../store/settings";
import type { Feature } from "../types";
import { GROUP } from "./logic";
import { FoeOverlay, ForceOverlay, PartyOverlay, TargetOverlay, YouOverlay } from "./Overlays";

/** Room for the icons beside a card. */
const BESIDE = () => settings.party.most * 28;
const forceOn = () => place(settings.places.force, { on: false, x: 0, y: 0.3, scale: 1 }).on;

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
    view: PartyOverlay, group: "Health", about: "The party's health, debuffs, and your buffs on them.", width: () => (settings.party.width + (settings.party.icons === "beside" ? BESIDE() : 0)) * settings.party.columns + 8,
    place: { on: false, x: 0, y: 0.4, scale: 1 }, empty: () => near.party.length < 2 || (near.party.length > GROUP && forceOn()),
  },
};
export const force: Feature = {
  id: "force",
  name: "Force frames",
  icon: "\ue902",
  overlay: {
    view: ForceOverlay, group: "Health", about: "The same for more than a party, in groups side by side, in a place of its own.", width: () => (settings.party.width + (settings.party.icons === "beside" ? BESIDE() : 0) + 12) * 2,
    place: { on: false, x: 0, y: 0.3, scale: 1 }, empty: () => near.party.length <= GROUP,
  },
};
