import type { Job, Unit } from "../../live/types.ts";
import type { Settings } from "../../store/settings.ts";

/** Health from 0 to 1. Nothing when it is not known. */
export const share = (u: Pick<Unit, "hp" | "maxHp">) => (u.hp < 0 || u.maxHp <= 0 ? undefined : Math.min(1, u.hp / u.maxHp));

export const dead = (u: Pick<Unit, "hp">) => u.hp === 0;

export const who = (u: Pick<Unit, "name" | "you">, at: number, hide: boolean | "all") =>
  u.you ? (hide !== "all" && u.name) || "You" : hide || !u.name ? `Player ${at + 1}` : u.name;

/** More than this many are a Force, in groups of so many. */
export const GROUP = 4;

/** Those who hold, then those who heal, then the rest. */
const ROLE: Partial<Record<Job, number>> = { templar: 0, gladiator: 0, cleric: 1, chanter: 1 };

/** The party in the order you want it. Each keeps its place in the game's own order, for names that are hidden. */
export function ordered(party: readonly Unit[], set: Pick<Settings["party"], "order" | "you">): { unit: Unit; at: number }[] {
  const all = party.map((unit, at) => ({ unit, at })).filter(({ unit }) => set.you || !unit.you);
  if (set.order === "name") all.sort((a, b) => a.unit.name.localeCompare(b.unit.name) || a.at - b.at);
  else if (set.order === "role") all.sort((a, b) => (ROLE[a.unit.job] ?? 2) - (ROLE[b.unit.job] ?? 2) || a.at - b.at);
  return all;
}

/** In groups of a Force, by the game's own order. */
export function groups<T>(all: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(all.length / GROUP) }, (_, i) => all.slice(i * GROUP, (i + 1) * GROUP));
}
