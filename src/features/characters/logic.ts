// Each of your characters as last seen, carried on to now by what comes back by itself.
import type { Entries } from "../../live/types.ts";
import type { Kind, Resource } from "../../store/settings.ts";
import { capOf, coming, KIND_NAMES, kindOf, RECHARGE, type Seen } from "../resources/logic.ts";

export interface Kept {
  name: string;
  job: string;
  /** When the numbers last changed. */
  at: number;
  odyle: [daily: number, charged: number];
  counts: Entries["counts"];
  duty: Entries["duty"];
  points: Entries["points"];
  kinah: number;
  shop?: Entries["shop"];
  crafts?: Entries["crafts"];
  /** The game's number for the map, 0 when not known. */
  map: number;
  /** Combat Power and item level as last said. 0 or missing when not known. */
  power?: number;
  level?: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const DAILY = 7 * HOUR;
/** Resets between two times: daily ones at 07:00 UTC, weekly ones on Wednesday. */
const passed = (from: number, to: number, every: number, offset: number) => Math.max(0, Math.floor((to - offset) / every) - Math.floor((from - offset) / every));
export const resetsBetween = (from: number, to: number) => ({ day: passed(from, to, DAY, DAILY), week: passed(from, to, 7 * DAY, 6 * DAY + DAILY) });

/** What it has now, at least: when in the last few hours it grew is not known, so whole steps only. Nothing more than the most. */
export function carried(kind: Kind | "odyle", n: number, at: number, now: number, member: boolean): number {
  const r = RECHARGE[kind];
  if (!r || n < 0) return n;
  const cap = capOf(kind, member)!;
  if (n >= cap) return n;
  // A look a little ahead of the clock is no time at all, not a step back.
  const steps = typeof r.every === "number" ? Math.floor(Math.max(0, now - at) / r.every) : resetsBetween(at, now)[r.every];
  return Math.min(cap, n + steps * r.gain);
}

/** Ms until Odyle Energy is full: exact when the hour it grows at was seen, else the longest it can be. 0 when full.
 * `since` is when the energy was last seen: what of the three hours passed since then is not waited again. */
export function fullIn(energy: number, member: boolean, seen: Seen | undefined, now: number, since = now): number {
  const cap = capOf("odyle", member)!;
  if (energy < 0) return Infinity;
  const steps = Math.ceil((cap - energy) / RECHARGE.odyle!.gain);
  if (steps <= 0) return 0;
  const every = 3 * HOUR;
  const first = coming("odyle", energy, member, seen, now)?.in ?? every - (Math.max(0, now - since) % every);
  return first + (steps - 1) * every;
}

export interface Line {
  name: string;
  value: number;
  most: number;
  /** It is full, and what the next reset brings is lost. */
  lost: boolean;
}

/** Entries you said the kind of or named, carried on to now. `most` is 0 when it is not known. */
export function lines(k: Kept, chosen: readonly Resource[], member: boolean, now: number): Line[] {
  return k.counts.flatMap(([id, first]) => {
    const kind = kindOf(id, chosen);
    const name = chosen.find((r) => r.id === id)?.name || (kind ? KIND_NAMES[kind] : "");
    if (!name) return [];
    const most = (kind && capOf(kind, member)) || 0;
    const value = kind ? carried(kind, first, k.at, now, member) : first;
    return [{ name, value, most, lost: !!most && value >= most }];
  });
}

/** Odyle Energy now, about, and when it is full. */
export function energy(k: Kept, member: boolean, now: number) {
  const value = carried("odyle", k.odyle[0], k.at, now, member);
  return { value, most: capOf("odyle", member)!, full: value < 0 ? Infinity : fullIn(value, member, undefined, now, k.at) };
}

/** What goes to waste first comes first: energy full soonest, then entries full. */
export const order = (all: readonly Kept[], chosen: readonly Resource[], member: boolean, now: number) =>
  [...all].sort((a, b) => energy(a, member, now).full - energy(b, member, now).full || lines(b, chosen, member, now).filter((l) => l.lost).length - lines(a, chosen, member, now).filter((l) => l.lost).length || a.name.localeCompare(b.name));
