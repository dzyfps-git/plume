import { near } from "../../live/store";
import type { Feature } from "../types";
import { ResourcesOverlay, shown } from "./Overlay";
import { ResourcesPage } from "./Page";

export const resources: Feature = {
  id: "resources",
  name: "Resources",
  icon: "",
  color: "#5fdc95",
  page: ResourcesPage,
  overlay: {
    view: ResourcesOverlay, group: "Other", about: "Odyle Energy, and the tickets and entries chosen on the Resources page.", width: 300,
    place: { on: false, x: 1, y: 0.5, scale: 1 }, empty: () => near.odyle[0] < 0 && !shown().length,
  },
};
