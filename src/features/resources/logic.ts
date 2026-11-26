import type { Entries } from "../../live/types.ts";
import type { Kind, Resource, Settings } from "../../store/settings.ts";
import { full } from "../../ui/format.ts";

/** As the game calls them. */
export const KIND_NAMES: Record<Kind, string> = {
  shugo: "Shugo Festival keys", invasion: "Dimensional Invasion", nightmare: "Nightmare", ascension: "Ascension Trial",
  transcendence: "Transcendence", conquest: "Conquest", exploration: "Exploration", fissure: "Unknown Fissure",
  subjugation: "Subjugation", forge: "Abyssal Forge", rift: "Spacetime Rift",
};

/** The parts Odyle Energy is shown in. */
export const ODYLE_NAMES: Record<Settings["odyle"]["parts"][number], string> = { energy: "Energy", charged: "Charged", cap: "Cap", runs: "Runs", time: "Time" };

/** Those known for sure, as A2Tools and Questlog found them. The game gives the others a number and no name. */
export const KNOWN: Record<number, Kind> = { 1: "shugo", 4: "nightmare", 8: "invasion", 101: "fissure", 80_000_001: "ascension" };

const HOUR = 3_600_000;

export interface Recharge {
  gain: number;
  /** In ms, or at a reset. */
  every: "day" | "week" | number;
  /** The most there can be, without and with a membership. */
  cap: number;
  member?: number;
}

/** What comes back by itself. Looked up in guides: NC has published none of it. */
export const RECHARGE: Partial<Record<Kind | "odyle", Recharge>> = {
  odyle: { gain: 15, every: 3 * HOUR, cap: 560, member: 840 },
  shugo: { gain: 3, every: "day", cap: 12, member: 21 },
  invasion: { gain: 1, every: "day", cap: 7 },
  nightmare: { gain: 2, every: "day", cap: 14 },
  conquest: { gain: 1, every: 8 * HOUR, cap: 21 },
  transcendence: { gain: 1, every: 12 * HOUR, cap: 14 },
  exploration: { gain: 7, every: "week", cap: 7 },
  fissure: { gain: 14, every: "week", cap: 14 },
  ascension: { gain: 3, every: "week", cap: 3 },
  subjugation: { gain: 3, every: "week", cap: 3 },
};

export const capOf = (kind: Kind | "odyle", member: boolean) => {
  const r = RECHARGE[kind];
  return r && ((member && r.member) || r.cap);
};

/** What was seen of one entry: the most it was, and how much came when. */
export interface Seen {
  most: number;
  gains: [amount: number, at: number][];
}
const REMEMBERED = 12;

/** With one more look at it. A drop, or another character's, is no gain. */
export function note(seen: Seen | undefined, before: number | undefined, now: number, at: number): Seen {
  const s = seen ?? { most: 0, gains: [] };
  const gained = before !== undefined && now > before ? [...s.gains, [now - before, at] as [number, number]].slice(-REMEMBERED) : s.gains;
  return { most: Math.max(s.most, now), gains: gained };
}

/** How long until more of it comes, and how much of the wait is over. Nothing when it is full, or its hour is not known. */
export function coming(kind: Kind | "odyle", count: number, member: boolean, seen: Seen | undefined, now: number): { in: number; part: number } | undefined {
  const r = RECHARGE[kind];
  if (!r || count < 0 || count >= capOf(kind, member)!) return undefined;
  if (typeof r.every !== "number") {
    const left = resets(now)[r.every === "day" ? "daily" : "weekly"];
    return { in: left, part: 1 - left / (r.every === "day" ? DAY : 7 * DAY) };
  }
  const { every, gain } = r;
  const last = seen?.gains.findLast(([n]) => n === gain)?.[1];
  if (last === undefined) return undefined;
  const left = every - ((now - last) % every);
  return { in: left, part: 1 - left / every };
}

/** This long after a reset, what came is from it. */
const NEAR_RESET = 10 * 60_000;

/** What an entry is, by how it grew and the most it was. Nothing when more than one fits: it is yours to say. */
export function guess(seen: Seen | undefined, taken: ReadonlySet<Kind | "">, member = true): Kind | "" {
  if (!seen?.most) return "";
  const at = (t: number): Recharge["every"] | "other" => {
    const { daily, weekly } = resets(t);
    return 7 * DAY - weekly < NEAR_RESET ? "week" : DAY - daily < NEAR_RESET ? "day" : "other";
  };
  const fits = (Object.keys(RECHARGE) as (Kind | "odyle")[]).filter((kind): kind is Kind => {
    if (kind === "odyle" || taken.has(kind)) return false;
    const r = RECHARGE[kind]!;
    if (seen.most > capOf(kind, member)!) return false;
    return seen.gains.every(([n, t]) => {
      const when = at(t);
      if (typeof r.every !== "number") return n === r.gain && (when === r.every || (when === "week" && r.every === "day"));
      // Those that come every few hours count from the daily reset.
      const since = DAY - resets(t).daily;
      return n === r.gain && since % r.every < NEAR_RESET;
    });
  });
  const full = fits.filter((kind) => capOf(kind, false) === seen.most || capOf(kind, true) === seen.most);
  // Without a gain it has to be as many as only one kind can have.
  const sure = seen.gains.length ? fits : full;
  return sure.length === 1 ? sure[0] : "";
}

export interface Left {
  key: string;
  name: string;
  /** What has an icon. */
  kind: Kind | "odyle" | "";
  value: string;
  /** The same as a number. */
  n: number;
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
  if (odyle[0] >= 0) list.push({ key: "odyle", name: "Odyle", kind: "odyle", value: full(odyle[0]), n: odyle[0], more: odyle[1] > 0 ? `+${full(odyle[1])}` : "", runs: runsLeft(odyle, perRun) });
  for (const r of chosen) {
    const found = r.show && entries.counts.find(([id]) => id === r.id);
    if (found) list.push({ key: String(r.id), name: nameOf(r.id, chosen) || `No. ${r.id}`, kind: kindOf(r.id, chosen), value: full(found[1]), n: found[1], more: found[2] > 0 ? `+${full(found[2])}` : "" });
  }
  return list;
}
