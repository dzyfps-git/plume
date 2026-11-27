import { followCloset } from "../closet/watch";
import type { Feature } from "../types";
import { nowhere, TrackerMapOverlay, TrackerOverlay } from "./Overlay";
import { MapPage } from "./Page";

export const map: Feature = {
  id: "map",
  name: "Map",
  icon: "\ue909",
  color: "#7fd6ff",
  page: MapPage,
  overlay: {
    view: TrackerMapOverlay, name: "Tracker Map", group: "World", about: "A small map around you, with what you track.", width: 240,
    place: { on: false, x: 1, y: 0.28, scale: 1 }, empty: nowhere,
  },
};

export const tracker: Feature = {
  id: "tracker",
  name: "Tracker",
  icon: "\ue707",
  color: "#7fd6ff",
  overlay: {
    view: TrackerOverlay, group: "World", about: "What you track on the map you are on, nearest first.", width: 260,
    place: { on: false, x: 1, y: 0.5, scale: 1 }, empty: nowhere,
    // Your Closet comes as the game says it, so it is kept by the overlay page, which runs while the game is heard.
    // Your pets are kept by Plume itself: see `src-tauri/src/pets.rs`.
    beside: followCloset,
  },
};
