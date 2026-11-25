import type { Feature } from "../types";
import { followFeed, LootOverlay, quiet } from "./Overlay";
import { LootPage } from "./Page";

export const loot: Feature = {
  id: "loot",
  name: "Loot",
  icon: "\ue7bf",
  color: "#ffcc55",
  page: LootPage,
  overlay: { view: LootOverlay, group: "World", about: "Items as you gain them, in the colour of their grade. The items you chose stand out.", width: 280, place: { on: false, x: 0.82, y: 0.6, scale: 1 }, empty: quiet, beside: followFeed },
};
