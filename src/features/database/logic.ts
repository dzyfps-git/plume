// One search over all that is known of the game: items, monsters, skills, effects, skins, pets, dungeons.
import type { ItemFile } from "../loot/logic.ts";
import type { SkinFile } from "../closet/logic.ts";
import type { PetFile } from "../pets/logic.ts";

export interface NameFile {
  made: string;
  skills: Record<string, string>;
  effects: Record<string, string>;
  /** Name, and 1 for a boss. */
  monsters: Record<string, [name: string, boss: number]>;
}

export interface Recipe {
  /** Item and how many. */
  of: [item: string, count: number][];
  /** What it can be made into, better. */
  better?: string;
  side?: "elyos" | "asmodian";
}

export interface RecipeFile {
  made: string;
  recipes: Record<string, Recipe>;
}

export const KINDS = ["item", "monster", "skill", "effect", "skin", "pet", "dungeon"] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_NAMES: Record<Kind, string> = { item: "Items", monster: "Monsters", skill: "Skills", effect: "Effects", skin: "Skins", pet: "Pets", dungeon: "Dungeons" };

export interface Entry {
  kind: Kind;
  name: string;
  /** All of the game's numbers under this name: ranks of a skill, monsters of one name in many places. */
  ids: number[];
  /** 0 Common to 5 Special, when it has one. */
  grade?: number;
  /** One more word: a dungeon's mode, a monster that is a boss. */
  more?: string;
}

export interface Files {
  items?: ItemFile | null;
  names?: NameFile | null;
  skins?: SkinFile | null;
  pets?: PetFile | null;
  dungeons?: Record<string, [string, string]> | null;
}

/** Everything once by kind and name, in the order it is given. */
export function index(f: Files): Entry[] {
  const out = new Map<string, Entry>();
  const add = (kind: Kind, id: number, name: string, grade?: number, more?: string) => {
    // Names with "_" are the game's own working names, not what a player sees.
    if (!name || name.includes("_")) return;
    const key = `${kind}\n${name}\n${more ?? ""}`;
    const had = out.get(key);
    if (had) had.ids.push(id);
    else out.set(key, { kind, name, ids: [id], grade, more });
  };
  for (const [id, [name, grade]] of Object.entries(f.items?.items ?? {})) add("item", Number(id), name, grade);
  for (const [id, [name, boss]] of Object.entries(f.names?.monsters ?? {})) add("monster", Number(id), name, undefined, boss ? "Boss" : undefined);
  for (const [id, name] of Object.entries(f.names?.skills ?? {})) add("skill", Number(id), name);
  for (const [id, name] of Object.entries(f.names?.effects ?? {})) add("effect", Number(id), name);
  for (const [id, skin] of Object.entries(f.skins?.skins ?? {})) add("skin", Number(id), skin[0], skin[2]);
  for (const p of f.pets?.pets ?? []) add("pet", p.id, p.name);
  for (const [id, [name, mode]] of Object.entries(f.dungeons ?? {})) add("dungeon", Number(id), name, undefined, mode);
  return [...out.values()];
}

/** The best matches first: the whole name, then its start, then a word's start, then anywhere. A number finds its thing. */
export function search(all: readonly Entry[], query: string, kind: Kind | "", most = 100): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const number = /^\d+$/.test(q) ? Number(q) : NaN;
  const rank = (e: Entry) => {
    if (e.ids.includes(number)) return 0;
    const n = e.name.toLowerCase();
    if (n === q) return 1;
    if (n.startsWith(q)) return 2;
    if (n.includes(` ${q}`)) return 3;
    return n.includes(q) ? 4 : 9;
  };
  return all
    .filter((e) => !kind || e.kind === kind)
    .map((e) => [rank(e), e] as const)
    .filter(([r]) => r < 9)
    .sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length || a[1].name.localeCompare(b[1].name))
    .slice(0, most)
    .map(([, e]) => e);
}

/** The recipes an item is part of. */
export const usedIn = (f: RecipeFile, item: number) => Object.entries(f.recipes).filter(([, r]) => r.of.some(([i]) => Number(i) === item)).map(([id]) => Number(id));
