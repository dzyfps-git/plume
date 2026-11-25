import type { Feature } from "../types";
import { bare, ResourcesOverlay } from "./Overlay";
import { ResourcesPage } from "./Page";
import { followGrowth } from "./watch";

export const resources: Feature = {
  id: "resources",
  name: "Resources",
  icon: "",
  color: "#5fdc95",
  page: ResourcesPage,
  overlay: {
    view: ResourcesOverlay, group: "Other", about: "Odyle Energy, and the tickets and entries chosen on the Resources page.", width: 300,
    place: { on: false, x: 1, y: 0.5, scale: 1 }, empty: bare, beside: followGrowth,
  },
};
