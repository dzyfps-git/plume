import { counted, runsLeft, type Left } from "../resources/logic.ts";
import type { Entries, Fight, Job, Near, Row, Saved, Skill } from "../../live/types.ts";
import type { Footer, Kind, View } from "../../store/settings.ts";
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
  id: BEST, name: "", job: "", damage: 0, dps: 0, share: 0, you: false, deaths: 0, taken: 0, hps: 0, power: 0, healing: 0, hits: 0, given: 0, got: 0, others: false,
};

/** With your best damage a second among them, as far as it would be by now. */
export function withBest(rows: readonly Ranked[], best: number | undefined, ms: number, job: Job): Ranked[] {
  if (!best) return [...rows];
  const total = best * Math.max(1, ms / 1000);
  const at = rows.findIndex((r) => r.total < total);
  return rows.toSpliced(at < 0 ? rows.length : at, 0, { row: { ...bestRow, job }, total, rate: best, share: 0 });
}

/** The rows that fit, with their ranks. Yours is always one of them, in the last place if it would fall off. */
export function shown<T extends { row: Pick<Row, "you" | "id"> }>(rows: readonly T[], most: number): (T & { rank: number })[] {
  let rank = 0;
  const all = rows.map((r) => ({ ...r, rank: r.row.id === BEST ? 0 : ++rank }));
  const top = all.slice(0, most);
  const you = all.find(({ row }) => row.you);
  if (you && !top.includes(you)) top[top.length - 1] = you;
  return top;
}

/** How long a bar is: its share of the biggest. */
export const length = (row: Pick<Row, "damage">, rows: readonly Pick<Row, "damage">[]) =>
  rows.length && rows[0].damage > 0 ? row.damage / rows[0].damage : 0;

export const partyDps = (fight: Pick<Fight, "total" | "ms">) => (fight.ms >= 1000 ? fight.total / (fight.ms / 1000) : fight.total);

export const label = (row: Pick<Row, "name" | "you"> & { others?: boolean }, hide: boolean, rank: number) =>
  row.others ? "Everyone else, about" : row.you ? row.name || "You" : hide || !row.name ? `Player ${rank}` : row.name;

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
  name: string;
  icon?: "ping" | "flight";
  thing?: Kind | "odyle" | "kina" | "points";
  value: string;
  more: string;
}

/** The footer you chose. What is not known is left out. */
export function footer(
  chosen: readonly Footer[],
  near: Pick<Near, "ping" | "odyle" | "flight">,
  fight: Pick<Fight, "total">,
  entries: Pick<Entries, "kinah" | "points">,
  tickets: readonly Left[] = [],
  perRun = 40,
): Foot[] {
  const all: Record<Footer, () => Foot[]> = {
    ping: () => (near.ping >= 0 ? [{ name: "Ping", icon: "ping", value: String(near.ping), more: "ms" }] : []),
    total: () => (fight.total > 0 ? [{ name: "Total", value: short(fight.total), more: "" }] : []),
    flight: () => (near.flight ? [{ name: "Flight", icon: "flight", value: String(Math.round(near.flight.now)), more: "s" }] : []),
    odyle: () => {
      const [daily, charged] = near.odyle;
      return daily >= 0 ? [{ name: "Odyle Energy", thing: "odyle", value: full(daily + Math.max(0, charged)), more: counted(runsLeft(near.odyle, perRun), "run") }] : [];
    },
    entries: () => tickets.filter((t) => t.key !== "odyle").map((t) => ({ name: t.name, ...(t.kind && { thing: t.kind }), value: t.value, more: t.more })),
    kina: () => (entries.kinah >= 0 ? [{ name: "Kina today", thing: "kina", value: short(entries.kinah), more: "" }] : []),
    points: () => (entries.points[0] >= 0 ? [{ name: "Abyss Points this week", thing: "points", value: short(entries.points[0]), more: "" }] : []),
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
