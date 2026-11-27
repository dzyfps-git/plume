// Pets as the engine's `tools/world.py` writes them, and your progress with them.

export const KINDS = ["cogni", "fera", "natura", "varian", "special"] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_NAMES: Record<Kind, string> = { cogni: "Cogni", fera: "Fera", natura: "Natura", varian: "Varian", special: "Special" };

/** Where a pet's souls drop: a monster, on a map, and how many spots it has. */
export interface Where {
  npc: number;
  name: string;
  level: number;
  map: number;
  at: string;
  zones: string[];
  spots: number;
}

export interface Pet {
  id: number;
  name: string;
  kind: Kind;
  where: Where[];
  /** Not in the game yet. */
  soon?: boolean;
  /** Its item at the Market. */
  market?: number;
  /** Its picture on the sheet of faces. */
  face?: number;
  /** How a pet without monsters is had, and until when. */
  how?: string;
  when?: string;
}

export interface PetFile {
  pets: Pet[];
  faces: { cell: number; columns: number };
}

/** Souls from one level to the next. */
export const NEEDED = [5, 25, 75] as const;
/** Pets you need for the crystals. */
export const CRYSTALS = 170;

/** Souls still to get, for a pet at `level` with `souls`, to reach `goal`. Special pets take none. */
export function toGo(pet: Pet, level: number, souls: number, goal: number) {
  if (pet.kind === "special" || level >= goal) return 0;
  let sum = 0;
  for (let l = level; l < goal; l++) sum += NEEDED[l];
  return Math.max(0, sum - souls);
}

/** Of everything to `goal`, how much is done, 0 to 1. */
export function done(pet: Pet, level: number, souls: number, goal: number) {
  if (pet.kind === "special") return level > 0 ? 1 : 0;
  const all = toGo(pet, 0, 0, goal);
  return all ? 1 - toGo(pet, level, souls, goal) / all : 1;
}

export const SOURCES = ["elyos", "asmodian", "abyss", "dungeon", "chest", "market", "shop", "other"] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_NAMES: Record<Source, string> = {
  elyos: "Elyos lands", asmodian: "Asmodian lands", abyss: "Abyss", dungeon: "Dungeons", chest: "Pet Soul Chests", market: "Black Cloud Merchant", shop: "Shop and packs", other: "Other",
};

/** The sides of the maps that have one. Anything else with monsters is a dungeon. */
const SIDES: Record<number, Source> = { 1010: "elyos", 1011: "elyos", 1000: "elyos", 1110: "asmodian", 1111: "asmodian", 1100: "asmodian", 20: "abyss", 22: "abyss", 23: "abyss" };

/** Where a pet's souls can be had. */
export function sources(pet: Pet): Source[] {
  const from = new Set<Source>(pet.where.map((w) => SIDES[w.map] ?? "dungeon"));
  if (/soul chest/i.test(pet.how ?? "")) from.add("chest");
  if (/black cloud/i.test(pet.how ?? "")) from.add("market");
  if (/shop >|founder|pet chest contains/i.test(pet.how ?? "")) from.add("shop");
  if (!from.size) from.add("other");
  return SOURCES.filter((s) => from.has(s));
}

/** Whether a pet is among those chosen: any of the kinds, and any of the places. None chosen is all. */
export const fits = (pet: Pet, kinds: ReadonlySet<Kind>, from: ReadonlySet<Source>) =>
  (!kinds.size || kinds.has(pet.kind)) && (!from.size || sources(pet).some((s) => from.has(s)));

/** How many have reached each level, of those that can. */
export function counts(all: readonly Pet[], levels: Record<string, number>) {
  return [1, 2, 3].map((goal) => all.filter((p) => (levels[p.id] ?? 0) >= goal).length);
}
