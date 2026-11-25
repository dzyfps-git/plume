import { near } from "../../live/store";
import type { Feature } from "../types";
import { followPvp, PvpOverlay, tally } from "./Overlay";

export const pvp: Feature = {
  id: "pvp",
  name: "PvP",
  icon: "",
  overlay: {
    view: PvpOverlay, group: "Other", about: "Kills, streak, Abyss Points and how long players held you. Begins anew after six hours without any.", width: 270,
    place: { on: false, x: 1, y: 0.12, scale: 1 },
    empty: () => !near.foe && !tally().kills && !tally().deaths && !tally().points,
    beside: followPvp,
  },
};
