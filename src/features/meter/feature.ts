import { fight } from "../../live/store";
import { settings } from "../../store";
import type { Feature } from "../types";
import { MeterOverlay } from "./Overlay";
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
    width: 280,
    place: { on: true, x: 1, y: 1, scale: 1 },
    empty: () => fight.rows.length === 0,
    edge: () => settings.meter.edge,
  },
};
