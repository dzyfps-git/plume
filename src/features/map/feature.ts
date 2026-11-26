import { followCloset } from "../closet/watch";
import { followPets } from "../pets/watch";
import type { Feature } from "../types";
import { nowhere, TrackerMapOverlay, TrackerOverlay } from "./Overlay";
import { MapPage } from "./Page";

export const map: Feature = {
  id: "map",
  name: "Map",
  icon: "",
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
  icon: "",
  color: "#7fd6ff",
  overlay: {
    view: TrackerOverlay, group: "World", about: "What you track on the map you are on, nearest first.", width: 260,
    place: { on: false, x: 1, y: 0.5, scale: 1 }, empty: nowhere,
    // Your pets and Closet come as the game says them, so they are kept here, where a window is always open.
    beside: () => (followPets(), followCloset()),
  },
};
