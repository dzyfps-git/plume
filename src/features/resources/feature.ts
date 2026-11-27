import type { Feature } from "../types";
import { bare, ResourcesOverlay } from "./Overlay";
import { ChecklistPage } from "./Page";
import { followGrowth } from "./watch";

export const resources: Feature = {
  id: "resources",
  name: "Checklist",
  icon: "",
  color: "#5fdc95",
  page: ChecklistPage,
  overlay: {
    view: ResourcesOverlay, name: "Odyle and tickets", group: "Other", about: "Odyle Energy, and the entries set to show on the meter in the Checklist's settings.", width: 300,
    place: { on: false, x: 1, y: 0.5, scale: 1 }, empty: bare, beside: followGrowth,
  },
};
