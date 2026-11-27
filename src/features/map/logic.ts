// Maps as the engine's `tools/world.py` writes them, and what can be worked out from them.
import type { Position } from "../../live/types.ts";
import type { Layer } from "../../store/settings.ts";

export interface MapInfo {
  id: number;
  name: string;
  side: "asmodian" | "elyos" | "abyss";
  /** How many marks it has. 0 is a picture only. */
  marks: number;
}

export interface Region {
  name: string;
  /** x, y, x, y and so on, in metres. */
  shape: number[];
}

export interface Label {
  name: string;
  x: number;
  y: number;
  village: boolean;
}

/** One kind of thing on a map, with every spot it stands at. */
export interface Thing {
  id: string;
  layer: Layer;
  name: string;
  npc?: number;
  level?: number;
  elite?: boolean;
  /** The pets whose souls it gives. */
  pets?: number[];
  /** Of a gathering node: what it is, and the items it gives. */
  sort?: string;
  items?: number[];
  /** x, y, z, region, zone, five numbers a spot. A region or zone of -1 is none. */
  spots: number[];
}

export interface WorldMap {
  id: number;
  name: string;
  side: MapInfo["side"];
  /** Left, top, right, bottom, in metres: the edges of its picture. */
  bounds: [number, number, number, number];
  regions: Region[];
  zones: string[];
  labels: Label[];
  things: Thing[];
}

export interface Spot {
  x: number;
  y: number;
  z: number;
  region: number;
  zone: number;
}

export const spots = (t: Thing): Spot[] =>
  Array.from({ length: Math.floor(t.spots.length / 5) }, (_, i) => {
    const [x, y, z, region, zone] = t.spots.slice(i * 5, i * 5 + 5);
    return { x, y, z, region, zone };
  });

/** A spot in one number, for keeping: whole metres from -8192 to 8191. */
export const pack = (x: number, y: number) => (Math.round(x) + 8192) * 16384 + (Math.round(y) + 8192);
export const unpack = (n: number) => ({ x: Math.floor(n / 16384) - 8192, y: (n % 16384) - 8192 });

export const keyOf = (map: number, t: Thing) => `${map}/${t.id}`;

export const LAYER_NAMES: Record<Layer, string> = {
  trace: "Empyrean Traces", cube: "Hidden Cubes", gather: "Gathering", monster: "Monsters", boss: "Field bosses", npc: "NPCs",
  teleport: "Teleports", village: "Villages", sealed: "Sealed dungeons", dungeon: "Dungeons", portal: "Portals", rift: "Rifts",
  stronghold: "Strongholds", monolith: "Monoliths", quest: "Quests",
};

/** The game's own picture of each kind of mark, as the engine's `tools/marks.py` fetches them. Monsters and traces have none. */
const LAYER_ICONS: Partial<Record<Layer, string>> = {
  boss: "UT_Marker_Monster_Boss_Aggressive", dungeon: "UT_Marker_Dungeon", rift: "UT_Marker_Rift", portal: "UT_Marker_AbyssPortal",
  monolith: "UT_Marker_Monolith_Light", quest: "UT_Marker_Quest_District_Incomplete", village: "UT_Marker_Vlillage",
  teleport: "UT_Marker_TeleportArtifact_Light_Engraved", sealed: "UT_Marker_Exploration_Seal", stronghold: "UT_Marker_Exploration_Occupation",
  npc: "UT_Marker_Shop", gather: "UT_Marker_Gather", cube: "site_HiddenCube",
};
/** A layer's picture; teleports are the side's own. */
export const markOf = (layer: Layer, side?: MapInfo["side"]) =>
  layer === "teleport" && side === "asmodian" ? "UT_Marker_TeleportArtifact_Dark_Engraved" : LAYER_ICONS[layer];
/** Layers with so many marks that they are dots until you come in close. */
export const DENSE: readonly Layer[] = ["gather", "npc", "cube"];

/** Marker colours, by layer. */
export const LAYER_COLOURS: Record<Layer, string> = {
  trace: "#7fd6ff", cube: "#ff4d4d", gather: "#5fdc95", monster: "#ff8f70", boss: "#ff5c7a", npc: "#c9b8ff", teleport: "#8f9bff",
  village: "#f2e6c9", sealed: "#e58cff", dungeon: "#d58cff", portal: "#62c8ff", rift: "#b86bff", stronghold: "#ffa64d",
  monolith: "#a9b4c8", quest: "#ffe08a",
};

/** Spots of these come without their height. */
export const FLAT: readonly Layer[] = ["cube", "stronghold"];

/** Those you tick as found. */
export const FINDABLE: readonly Layer[] = ["trace", "cube"];

export const SIDE_NAMES: Record<MapInfo["side"], string> = { asmodian: "Asmodian", elyos: "Elyos", abyss: "Abyss" };

export function inside(x: number, y: number, shape: readonly number[]) {
  let within = false;
  for (let i = 0, j = shape.length - 2; i < shape.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [shape[i], shape[i + 1], shape[j], shape[j + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) within = !within;
  }
  return within;
}

const area = (shape: readonly number[]) => {
  let sum = 0;
  for (let i = 0, j = shape.length - 2; i < shape.length; j = i, i += 2) sum += shape[j] * shape[i + 1] - shape[i] * shape[j + 1];
  return Math.abs(sum / 2);
};

/** The smallest region a point is in, or -1. */
export function regionAt(m: WorldMap, x: number, y: number) {
  let best = -1;
  let least = Infinity;
  m.regions.forEach((r, i) => {
    const a = area(r.shape);
    if (a < least && inside(x, y, r.shape)) [best, least] = [i, a];
  });
  return best;
}

export const metres = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Where a point of the map is on its picture, of `size` points across. */
export function onPicture(m: WorldMap, x: number, y: number, size: number) {
  const [left, top, right, bottom] = m.bounds;
  return { x: ((x - left) / (right - left)) * size, y: ((y - top) / (bottom - top)) * size };
}

export function fromPicture(m: WorldMap, px: number, py: number, size: number) {
  const [left, top, right, bottom] = m.bounds;
  return { x: left + (px / size) * (right - left), y: top + (py / size) * (bottom - top) };
}

export const isFound = (found: Record<string, number[]>, key: string, s: { x: number; y: number }) => found[key]?.includes(pack(s.x, s.y)) ?? false;

export interface Near {
  thing: Thing;
  spot: Spot;
  key: string;
  /** From you, or 0 when you are not known. */
  away: number;
  /** How far above you, in metres. */
  up: number;
}

/** Each spot of these that is not found, nearest first, or in the file's order when you are not known. */
export function nearest(m: WorldMap, things: readonly Thing[], found: Record<string, number[]>, you?: { x: number; y: number; z: number } | null, most = 200): Near[] {
  const all: Near[] = [];
  for (const thing of things) {
    const key = keyOf(m.id, thing);
    for (const spot of spots(thing)) {
      if (FINDABLE.includes(thing.layer) && isFound(found, key, spot)) continue;
      all.push({ thing, spot, key, away: you ? metres(spot, you) : 0, up: you && !FLAT.includes(thing.layer) ? spot.z - you.z : 0 });
    }
  }
  if (you) all.sort((a, b) => a.away - b.away);
  return all.slice(0, most);
}

/** The nearest teleport to a spot, and how far it is. */
export function teleportNear(m: WorldMap, s: { x: number; y: number }): { name: string; away: number } | null {
  let best: { name: string; away: number } | null = null;
  for (const t of m.things) {
    if (t.layer !== "teleport") continue;
    for (const p of spots(t)) {
      const away = metres(p, s);
      if (!best || away < best.away) best = { name: t.name, away };
    }
  }
  return best;
}

/** Faster than this is a teleport, not a run. */
const FASTEST = 25;
/** A guess goes on this long past the last place said. */
export const GUESS_MS = 3000;

/** Where you likely are now: the last place said, carried on as you went from the one before. */
export function guess(before: Position | null, last: Position, now: number): { x: number; y: number; z: number; guess: boolean } {
  const still = { x: last.x, y: last.y, z: last.z, guess: false };
  if (!before || !before.known || !last.known || before.map !== last.map) return still;
  const ms = last.at - before.at;
  const speed = ms > 0 ? (metres(last, before) / ms) * 1000 : 0;
  // Past three seconds without a word the guess is over: where you were last said is all that is known.
  if (ms <= 0 || ms > 5000 || speed < 0.5 || speed > FASTEST || now - last.at > GUESS_MS) return still;
  const ahead = Math.max(0, now - last.at) / ms;
  return {
    x: last.x + (last.x - before.x) * ahead,
    y: last.y + (last.y - before.y) * ahead,
    z: last.z + (last.z - before.z) * ahead,
    guess: ahead > 0,
  };
}

/** Gives the spot as found, or not found again. */
export function tick(found: Record<string, number[]>, key: string, s: { x: number; y: number }): Record<string, number[]> {
  const n = pack(s.x, s.y);
  const now = found[key] ?? [];
  const next = now.includes(n) ? now.filter((m) => m !== n) : [...now, n];
  const { [key]: _, ...rest } = found;
  return next.length ? { ...rest, [key]: next } : rest;
}

/** How many of a kind there are on a map, and how many of them you found. */
export function counted(m: WorldMap, layer: Layer, found: Record<string, number[]>) {
  let all = 0;
  let done = 0;
  for (const t of m.things) {
    if (t.layer !== layer) continue;
    const key = keyOf(m.id, t);
    for (const s of spots(t)) {
      all += 1;
      if (isFound(found, key, s)) done += 1;
    }
  }
  return { all, done };
}

/** The same, by region: those outside any region come last, as "". */
export function byRegion(m: WorldMap, layer: Layer, found: Record<string, number[]>) {
  const rows = new Map<string, { all: number; done: number }>();
  for (const t of m.things) {
    if (t.layer !== layer) continue;
    const key = keyOf(m.id, t);
    for (const s of spots(t)) {
      const name = m.regions[s.region]?.name ?? "";
      const row = rows.get(name) ?? { all: 0, done: 0 };
      row.all += 1;
      if (isFound(found, key, s)) row.done += 1;
      rows.set(name, row);
    }
  }
  return [...rows].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b))).map(([name, row]) => ({ name, ...row }));
}

/** Words of a search, each found somewhere in the text. */
export const matches = (query: string, ...text: (string | undefined)[]) => {
  const all = text.join(" ").toLowerCase();
  return query.toLowerCase().split(/\s+/).every((w) => all.includes(w));
};

/** Every item that drops, and from what. Chances are out of 100,000,000. */
export interface Drops {
  items: Record<string, [grade: number, name: string]>;
  lists: number[][];
  mobs: Record<string, { name: string; lists: number[] }>;
}

export const percent = (chance: number) => Math.min(100, chance / 1_000_000);

export interface Drop {
  item: number;
  name: string;
  grade: number;
  /** In percent. */
  chance: number;
}

/** What a monster drops, likeliest first. */
export function dropsOf(d: Drops, npc: number): Drop[] {
  const out = new Map<number, Drop>();
  for (const at of d.mobs[npc]?.lists ?? []) {
    const list = d.lists[at] ?? [];
    for (let i = 0; i + 1 < list.length; i += 2) {
      const [item, chance] = [list[i], percent(list[i + 1])];
      const [grade, name] = d.items[item] ?? [0, ""];
      if (!name || (out.get(item)?.chance ?? -1) >= chance) continue;
      out.set(item, { item, name, grade, chance });
    }
  }
  return [...out.values()].sort((a, b) => b.chance - a.chance || a.name.localeCompare(b.name));
}

/** Which monsters drop an item, and how likely. */
export function droppers(d: Drops, item: number): { npc: number; name: string; chance: number }[] {
  const lists = new Map<number, number>();
  d.lists.forEach((list, at) => {
    for (let i = 0; i + 1 < list.length; i += 2) if (list[i] === item) lists.set(at, Math.max(lists.get(at) ?? 0, percent(list[i + 1])));
  });
  const out: { npc: number; name: string; chance: number }[] = [];
  for (const [npc, mob] of Object.entries(d.mobs)) {
    const chance = Math.max(-1, ...mob.lists.map((l) => lists.get(l) ?? -1));
    if (chance >= 0) out.push({ npc: Number(npc), name: mob.name, chance });
  }
  return out.sort((a, b) => b.chance - a.chance || a.name.localeCompare(b.name));
}

/** Items whose names fit a search, at most `most`. */
export function itemsLike(d: Drops, query: string, most = 40) {
  if (query.trim().length < 2) return [];
  const out: { item: number; name: string; grade: number }[] = [];
  for (const [id, [grade, name]] of Object.entries(d.items)) {
    if (matches(query, name)) out.push({ item: Number(id), name, grade });
    if (out.length >= most) break;
  }
  return out;
}

/** Distance in plain words. */
export const far = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/** Above or below you, when it matters. */
export const height = (up: number) => (Math.abs(up) < 8 ? "" : up > 0 ? `${Math.round(up)} m up` : `${Math.round(-up)} m down`);
