import { capOf, counted, runsLeft, type Left } from "../resources/logic.ts";
import type { Entries, Fight, Job, Near, Row, Saved, Skill } from "../../live/types.ts";
import type { Footer, Kind, Settings, View } from "../../store/settings.ts";
import { full, short } from "../../ui/format.ts";

export const VIEW_NAMES: Record<View, string> = {
  damage: "Damage",
  rdps: "Damage with buffs counted",
  ndps: "Damage without others' buffs",
  healing: "Healing",
  taken: "Damage taken",
  hits: "Hits a second",
};

export interface Ranked {
  row: Row;
  /** All of it, and each second. */
  total: number;
  rate: number;
  share: number;
}

/** Rows by what the meter shows, the most first. Nobody's place but damage's changes the party's total. */
export function ranked(fight: Pick<Fight, "rows" | "ms">, view: View): Ranked[] {
  const seconds = Math.max(1, fight.ms / 1000);
  const of: Record<View, (r: Row) => number> = {
    damage: (r) => r.damage,
    rdps: (r) => r.damage - r.got + r.given,
    ndps: (r) => r.damage - r.got,
    healing: (r) => r.healing,
    taken: (r) => r.taken,
    hits: (r) => r.hits,
  };
  const rows = fight.rows.map((row) => ({ row, total: of[view](row) }));
  const sum = rows.reduce((all, r) => all + r.total, 0);
  return rows
    // Only damage has a place for those who did none.
    .filter((r) => view === "damage" || (r.total > 0 && !(r.row.others && !view.endsWith("dps"))))
    .map(({ row, total }) => ({
      row, total,
      // The engine's own number, so that the meter and the game agree.
      rate: view === "damage" ? row.dps : total / seconds,
      share: sum > 0 ? (total / sum) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total || a.row.id - b.row.id);
}

/** The row that stands for your best fight. It is nobody's place. */
export const BEST = -1;
export const bestRow: Row = {
  id: BEST, name: "", job: "", damage: 0, dps: 0, share: 0, you: false, deaths: 0, taken: 0, hps: 0, power: 0, level: 0, healing: 0, hits: 0, given: 0, got: 0, others: false,
};

/** With your best damage a second among them, as far as it would be by now. */
export function withBest(rows: readonly Ranked[], best: number | undefined, ms: number, job: Job): Ranked[] {
  if (!best) return [...rows];
  const total = best * Math.max(1, ms / 1000);
  const at = rows.findIndex((r) => r.total < total);
  return rows.toSpliced(at < 0 ? rows.length : at, 0, { row: { ...bestRow, job }, total, rate: best, share: 0 });
}

/** The rows that fit, with their ranks. Yours is always one of them, in the last place if it would fall off, or the first if `first`. */
export function shown<T extends { row: Pick<Row, "you" | "id"> }>(rows: readonly T[], most: number, first = false): (T & { rank: number })[] {
  let rank = 0;
  const all = rows.map((r) => ({ ...r, rank: r.row.id === BEST ? 0 : ++rank }));
  const top = all.slice(0, most);
  const you = all.find(({ row }) => row.you);
  if (you && !top.includes(you)) top[top.length - 1] = you;
  return first && you ? [you, ...top.filter((r) => r !== you)] : top;
}

/** How much a second you are short of the place above yours. */
export function gap(rows: readonly Pick<Ranked, "row" | "rate">[]): number | undefined {
  const real = rows.filter(({ row }) => row.id !== BEST && !row.others);
  const at = real.findIndex(({ row }) => row.you);
  return at > 0 ? Math.max(0, real[at - 1].rate - real[at].rate) : undefined;
}

/** Seconds that count as now, and how far above their own average that has to be. */
const NOW_MS = 5_000;
const BURST = 1.6;
const STEADY_MS = 12_000;

/** Who does far more now than in the fight so far. Keeps what it needs from look to look. */
export function bursts() {
  let past: { ms: number; damage: Map<number, number> }[] = [];
  return (fight: Pick<Fight, "ms" | "rows">): ReadonlySet<number> => {
    if (past.length && fight.ms < past[past.length - 1].ms) past = [];
    past.push({ ms: fight.ms, damage: new Map(fight.rows.map((r) => [r.id, r.damage])) });
    while (past.length > 1 && past[1].ms <= fight.ms - NOW_MS) past.shift();
    const from = past[0];
    const span = fight.ms - from.ms;
    if (fight.ms < STEADY_MS || span < NOW_MS * 0.6) return new Set();
    return new Set(fight.rows.filter((r) => r.damage > 0 && !r.others && (r.damage - (from.damage.get(r.id) ?? 0)) / span > (r.damage / fight.ms) * BURST).map((r) => r.id));
  };
}

/** How long a bar is: its share of the biggest. */
export const length = (row: Pick<Row, "damage">, rows: readonly Pick<Row, "damage">[]) =>
  rows.length && rows[0].damage > 0 ? row.damage / rows[0].damage : 0;

export const partyDps = (fight: Pick<Fight, "total" | "ms">) => (fight.ms >= 1000 ? fight.total / (fight.ms / 1000) : fight.total);

export const label = (row: Pick<Row, "name" | "you"> & { others?: boolean }, hide: boolean | "all", rank: number) =>
  row.others ? "Everyone else, about" : row.you ? (hide !== "all" && row.name) || "You" : hide || !row.name ? `Player ${rank}` : row.name;

/** Combat Power as the game's players say it: 112.0K. */
export const power = (n: number) => (n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n > 0 ? String(n) : "");

/** Too short to hold against a whole fight. */
const PROOF = 15_000;

export interface Against {
  /** Which try of this target it is, of those kept. */
  pull: number;
  /** Your best damage a second on it, and how this fight compares, as a part of it. */
  best?: number;
  change?: number;
}

/** This fight against your kept ones of the same target, with the same class. One that was just kept is this one. */
export function against(
  fight: { ms: number; target: Pick<Fight["target"], "code" | "name">; rows: readonly Pick<Row, "you" | "job" | "damage" | "dps">[] },
  kept: readonly Saved[],
): Against | undefined {
  const you = fight.rows.find((r) => r.you);
  const { code, name } = fight.target;
  if (!you || (!code && !name)) return undefined;
  const same = kept.filter((f) => (code ? f.code === code : f.target === name) && f.you && f.you.damage !== you.damage && !(you.job && f.you.job && f.you.job !== you.job));
  const best = Math.max(0, ...same.filter((f) => f.ms >= PROOF).map((f) => f.you!.dps));
  return { pull: same.length + 1, ...(best > 0 && { best, ...(fight.ms >= PROOF && { change: you.dps / best - 1 }) }) };
}

/** How much better a kept fight was than the best of the others, as a part of it. Nothing when it was not. */
export function gain(fight: Saved, kept: readonly Saved[]): number | undefined {
  const { ms, code, target: name, you } = fight;
  const change = you ? against({ ms, target: { code, name }, rows: [{ ...you, you: true }] }, kept.filter((f) => f.id !== fight.id))?.change : undefined;
  return change !== undefined && change > 0 ? change : undefined;
}

/** +4%, -12% */
export const signed = (part: number) => `${part >= 0 ? "+" : "-"}${Math.abs(Math.round(part * 100))}%`;

/** One figure of the footer, with an icon or else its name. */
export interface Foot {
  key: string;
  name: string;
  icon?: "ping" | "flight";
  thing?: Kind | "odyle" | "kina" | "points";
  value: string;
  /** On top of it. */
  bonus?: string;
  more: string;
  /** The value as a number, when a change of it is worth a word. */
  n?: number;
  tone?: "ending" | "best" | "muted";
}

export type FootSet = Pick<Settings, "odyleRun" | "odyle" | "pingAs">;

/** Of its cap, this much is near it. */
const NEAR_CAP = 0.9;

/** Odyle Energy in the parts you chose. */
export function odyleFoot([daily, charged]: readonly [number, number], set: Pick<FootSet, "odyle" | "odyleRun">): Foot {
  const { parts, member, warn } = set.odyle;
  const has = (part: (typeof parts)[number]) => parts.includes(part);
  const base = { key: "odyle", name: "Odyle Energy", thing: "odyle" } as const;
  if (daily < 0) return { ...base, value: "\u2013", more: "log in once more", tone: "muted" };
  const cap = capOf("odyle", member)!;
  const near = warn && daily >= cap * NEAR_CAP;
  const runs = counted(runsLeft([daily, charged], set.odyleRun), "run");
  const more = [has("cap") ? `of ${full(cap)}` : "", has("runs") ? runs : "", near ? (daily >= cap ? "full" : "nearly full") : ""];
  return {
    ...base, value: has("energy") ? full(daily) : "", bonus: has("charged") && charged > 0 ? `+${full(charged)}` : "", more: more.filter(Boolean).join(", "), n: daily,
    ...(near && { tone: "ending" as const }),
  };
}

/** The footer you chose. What is not known is left out, but for Odyle Energy, which says how to get it. */
export function footer(
  chosen: readonly Footer[],
  near: Pick<Near, "ping" | "odyle" | "flight">,
  fight: Pick<Fight, "total" | "own">,
  entries: Pick<Entries, "kinah" | "points">,
  tickets: readonly Left[],
  set: FootSet,
): Foot[] {
  const part = (n: number) => (fight.own[0] > 0 ? `${Math.round((n / fight.own[0]) * 100)}%` : "");
  const chip = (key: "crit" | "back", name: string, n: number): Foot[] => (fight.own[0] > 0 ? [{ key, name, value: part(n), more: "" }] : []);
  const ping = set.pingAs === "oneway" ? Math.round(near.ping / 2) : near.ping;
  const all: Record<Footer, () => Foot[]> = {
    ping: () => (near.ping >= 0 ? [{ key: "ping", name: set.pingAs === "oneway" ? "Ping, one way" : "Ping", icon: "ping", value: String(ping), more: "ms" }] : []),
    total: () => (fight.total > 0 ? [{ key: "total", name: "Total", value: short(fight.total), more: "" }] : []),
    flight: () => (near.flight ? [{ key: "flight", name: "Flight", icon: "flight", value: String(Math.round(near.flight.now)), more: "s" }] : []),
    odyle: () => [odyleFoot(near.odyle, set)],
    entries: () => tickets.filter((t) => t.key !== "odyle").map((t) => ({ key: t.key, name: t.name, ...(t.kind && { thing: t.kind }), value: t.value, bonus: t.more, more: "", n: t.n })),
    kina: () => (entries.kinah >= 0 ? [{ key: "kina", name: "Kina today", thing: "kina", value: short(entries.kinah), more: "" }] : []),
    points: () => (entries.points[0] >= 0 ? [{ key: "points", name: "Abyss Points this week", thing: "points", value: short(entries.points[0]), more: "" }] : []),
    crit: () => chip("crit", "Crit", fight.own[1]),
    back: () => chip("back", "Back", fight.own[2]),
  };
  return chosen.flatMap((f) => all[f]());
}

export interface SkillLine extends Skill {
  share: number;
  average: number;
  crit: number;
  back: number;
  perfect: number;
  double: number;
  /** Hits with extra hits, as a part of all. Nothing in fights of older versions, as with those the enemy parried. */
  multi?: number;
  parry?: number;
}

/** Skills with the numbers worked out from them. Direct hits and ticks of one skill stay apart. */
export function lines(skills: readonly Skill[]): SkillLine[] {
  const total = skills.reduce((sum, s) => sum + s.damage, 0);
  const part = (n: number, s: Skill) => (s.hits > 0 ? n / s.hits : 0);
  return skills.map((s) => ({
    ...s,
    share: total > 0 ? s.damage / total : 0,
    average: part(s.damage, s),
    crit: part(s.crits, s),
    back: part(s.backs, s),
    perfect: part(s.perfects, s),
    double: part(s.doubles, s),
    multi: s.multis === undefined ? undefined : part(s.multis, s),
    parry: s.parries === undefined ? undefined : part(s.parries, s),
  }));
}
