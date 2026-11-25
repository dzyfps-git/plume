import type { Feature } from "../types";
import { AurasOverlay, followAuras, shown } from "./Overlay";
import { AurasPage } from "./Page";

export const auras: Feature = {
  id: "auras",
  name: "Auras",
  icon: "",
  page: AurasPage,
  overlay: {
    view: AurasOverlay, group: "Effects", about: "What you built on the Auras page.", width: 280,
    place: { on: false, x: 0.5, y: 0.64, scale: 1 }, empty: () => !shown().length, beside: followAuras,
  },
};
