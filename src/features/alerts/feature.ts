import type { Feature } from "../types";
import { CalloutsOverlay, empty, followAlerts } from "./Overlay";
import { AlertsPage } from "./Page";

/** Under its overlay's name there, and under its page's in the menu. */
export const alerts: Feature = {
  id: "alerts",
  name: "Alerts",
  icon: "",
  page: AlertsPage,
  overlay: {
    view: CalloutsOverlay, group: "Fight", name: "Callouts", about: "Alerts, your notes for a boss, and its mechanics as they come, in large letters.", width: 460,
    place: { on: false, x: 0.5, y: 0.4, scale: 1 }, empty, beside: followAlerts,
  },
};
