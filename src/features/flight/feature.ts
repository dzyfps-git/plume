import { near } from "../../live/store";
import type { Feature } from "../types";
import { FlightOverlay } from "./Overlay";

export const flight: Feature = {
  id: "flight",
  name: "Flight time",
  icon: "",
  overlay: {
    view: FlightOverlay, group: "Other", about: "How long you can fly, and when it is full again.", width: 170,
    place: { on: false, x: 0.5, y: 0.8, scale: 1 },
    // Full and on the ground there is nothing to know.
    empty: () => !near.flight || (!near.flight.flying && near.flight.max > 0 && near.flight.now >= near.flight.max),
  },
};
