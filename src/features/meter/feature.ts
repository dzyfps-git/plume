import { fight } from "../../live/store";
import type { Feature } from "../types";
import { MeterOverlay } from "./Overlay";
import { MeterPage } from "./Page";

export const meter: Feature = {
  id: "meter",
  name: "Damage meter",
  icon: "",
  page: MeterPage,
  overlay: {
    view: MeterOverlay,
    about: "Everyone's damage, with the target and the clock in its header.",
    width: 300,
    place: { on: true, x: 1, y: 0.62, scale: 1 },
    empty: () => fight.rows.length === 0,
  },
};
