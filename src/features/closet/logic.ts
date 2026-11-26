// The skins in your Closet, against all of the game's, and where the rest come from.
import type { Skins } from "../../live/types.ts";

/** Name, the Asmodian name when it differs, grade 0 to 4, slot, the game's order, where it comes from, and its picture when known. */
export type Skin = [name: string, other: string, grade: number, slot: string, order: number, from: string[], picture?: string];

export interface SkinFile {
  made: string;
  skins: Record<string, Skin>;
}

export interface Closet {
  ids: number[];
  /** When the game last said all of them. 0 is never. */
  told: number;
}

export const GRADES = ["common", "rare", "legend", "unique", "epic"] as const;

export const SLOTS = {
  Weapons: ["Greatsword", "Sword", "Dagger", "Bow", "Magicbook", "Orb", "Staff", "Mace"],
  Armour: ["Helmet", "Shoulder", "Torso", "Pants", "Gloves", "Boots", "Cape"],
  Accessories: ["Earring", "Necklace", "EyeWear", "MouthWear", "ShoulderWear"],
} as const;

/** The game's slot names, as words. */
export const slotName = (slot: string) => ({ Magicbook: "Spellbook", EyeWear: "Eyewear", MouthWear: "Mouthwear", ShoulderWear: "On the shoulder" })[slot] ?? slot;

export function heard(was: Closet, said: Skins, now: number): Closet {
  if (said.what === "all") return { ids: [...new Set(said.ids)], told: now };
  const ids = [...new Set([...was.ids, ...said.ids])];
  return ids.length === was.ids.length ? was : { ...was, ids };
}

export type Show = "all" | "have" | "missing";

export interface Row {
  id: number;
  skin: Skin;
  have: boolean;
}

/** Skins as chosen, in the game's order. A search looks at names and at where they come from. */
export function rows(file: SkinFile, owned: ReadonlySet<number>, show: Show, slot: string, query: string): Row[] {
  const words = query.trim().toLowerCase();
  return Object.entries(file.skins)
    .map(([id, skin]) => ({ id: Number(id), skin, have: owned.has(Number(id)) }))
    .filter((r) =>
      (show === "all" || r.have === (show === "have")) &&
      (!slot || r.skin[3] === slot) &&
      (!words || r.skin[0].toLowerCase().includes(words) || r.skin[1].toLowerCase().includes(words) || r.skin[5].some((f) => f.toLowerCase().includes(words))),
    )
    .sort((a, b) => a.skin[4] - b.skin[4] || a.id - b.id);
}
