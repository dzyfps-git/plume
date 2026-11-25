import type { Feature } from "../types";
import { TimeOverlay } from "./Overlay";
import { TimePage } from "./Page";

export const time: Feature = {
  id: "time",
  name: "Time",
  icon: "\ue121",
  color: "#7fb4ff",
  page: TimePage,
  overlay: { view: TimeOverlay, name: "Time bar", group: "Other", about: "The server's time, the next events, the daily reset, and the stopwatch.", width: 520, place: { on: false, x: 0.5, y: 0, scale: 1 } },
};
