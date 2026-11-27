import type { Feature } from "../types";
import { AurasOverlay, followAuras, ownAuras, together } from "./Overlay";
import { AurasPage } from "./Page";

export const auras: Feature = {
  id: "auras",
  name: "Auras",
  icon: "",
  color: "#dd6cf0",
  page: AurasPage,
  overlay: {
    view: AurasOverlay, group: "Effects", about: "What you built on the Auras page. One with a place of its own is moved by itself.", width: 280,
    place: { on: false, x: 0.5, y: 0.64, scale: 1 }, empty: () => !together().length, beside: followAuras,
  },
  more: ownAuras,
};
