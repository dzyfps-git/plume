import { settings } from "../../store";
import type { Feature } from "../types";
import { followMeter } from "./live";
import { bare, MeterOverlay } from "./Overlay";
import { MeterPage } from "./Page";

export const meter: Feature = {
  id: "meter",
  name: "Damage meter",
  icon: "",
  color: "#b18cff",
  page: MeterPage,
  overlay: {
    view: MeterOverlay,
    group: "Fight",
    about: "Everyone's damage, with the boss's health above and what you have left below.",
    width: () => settings.look.width,
    place: { on: true, x: 1, y: 1, scale: 1 },
    empty: bare,
    beside: followMeter,
    loose: () => !settings.meter.locked,
    edge: () => settings.meter.edge,
  },
};
