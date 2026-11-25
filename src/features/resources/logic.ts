import type { Entries } from "../../live/types.ts";
import type { Kind, Resource } from "../../store/settings.ts";
import { full } from "../../ui/format.ts";

/** As the game calls them. */
export const KIND_NAMES: Record<Kind, string> = {
  shugo: "Shugo Festival keys", invasion: "Dimensional Invasion", nightmare: "Nightmare", ascension: "Ascension Trial",
  transcendence: "Transcendence", conquest: "Conquest", exploration: "Exploration", fissure: "Unknown Fissure",
  subjugation: "Subjugation", forge: "Abyssal Forge", rift: "Spacetime Rift",
};

/** Those the engine knows for sure. The game gives the others a number and no name. */
export const KNOWN: Record<number, Kind> = { 1: "shugo" };

export interface Left {
  key: string;
  name: string;
  /** What has an icon. */
  kind: Kind | "odyle" | "";
  value: string;
  /** On top of it, as the game says it second. */
  more: string;
  /** Runs it is enough for. */
  runs?: number;
}

const DAY = 86_400_000;
/** 07:00 UTC, and on Wednesdays the weekly one. The epoch began on a Thursday. */
const DAILY = 7 * 3_600_000;

/** How long until the next daily and weekly reset. */
export function resets(now: number): { daily: number; weekly: number } {
  const until = (every: number, from: number) => every - ((((now - from) % every) + every) % every);
  return { daily: until(DAY, DAILY), weekly: until(7 * DAY, 6 * DAY + DAILY) };
}

/** 2 d 3 h, 5 h 20 m, 12 m */
export function wait(ms: number): string {
  const m = Math.ceil(ms / 60_000);
  if (m >= 1440) return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`;
}

export const kindOf = (id: number, chosen: readonly Resource[]): Kind | "" => chosen.find((r) => r.id === id)?.kind || KNOWN[id] || "";
export function nameOf(id: number, chosen: readonly Resource[]): string {
  const kind = kindOf(id, chosen);
  return chosen.find((r) => r.id === id)?.name || (kind ? KIND_NAMES[kind] : "");
}

/** Runs that are left, when each takes `perRun`. */
export const runsLeft = (odyle: readonly [number, number], perRun: number) => Math.floor((Math.max(0, odyle[0]) + Math.max(0, odyle[1])) / perRun);
export const counted = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What you chose to see, with what is there of it. What is not known is left out. */
export function strip(entries: Entries, odyle: readonly [number, number], chosen: readonly Resource[], perRun = 40): Left[] {
  const list: Left[] = [];
  if (odyle[0] >= 0) list.push({ key: "odyle", name: "Odyle", kind: "odyle", value: full(odyle[0]), more: odyle[1] > 0 ? `+${full(odyle[1])}` : "", runs: runsLeft(odyle, perRun) });
  for (const r of chosen) {
    const found = r.show && entries.counts.find(([id]) => id === r.id);
    if (found) list.push({ key: String(r.id), name: nameOf(r.id, chosen) || `No. ${r.id}`, kind: kindOf(r.id, chosen), value: full(found[1]), more: found[2] > 0 ? `+${full(found[2])}` : "" });
  }
  return list;
}
