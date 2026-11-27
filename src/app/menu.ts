// How the menu is ordered: in groups, each with a colour. Home and the pages list them the same way.

/** The menu's groups, in order, each with a colour. A page in none stands first. */
export const NAV_GROUPS = [
  { name: "In game", color: "#ff8a6b", ids: ["meter", "training", "bosses", "auras", "alerts", "loot"] },
  { name: "Records", color: "#62c8ff", ids: ["history", "resources", "time"] },
  { name: "World", color: "#5fd896", ids: ["map", "pets", "closet", "builds", "database"] },
  { name: "Setup", color: "#a9b4c8", ids: ["look", "overlays", "settings"] },
] as const;
