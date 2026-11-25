// You against your best: grades, the best kill's health, splits, bursts, records and streaks. All from your own kept fights.
import type { Saved, Target } from "../../live/types.ts";
import { kind, pace, type Run } from "../history/logic.ts";

/** A shorter fight proves nothing. */
const PROOF = 15_000;
const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export type GradeTone = "grey" | "green" | "blue" | "violet" | "orange" | "gold";
export interface Grade {
  /** 0 to 100: how many of your others it beat. */
  score: number;
  tone: GradeTone;
  /** The others it was held against. */
  of: number;
}

/** Others there have to be. */
const OTHERS = 3;
const TONES: [least: number, tone: GradeTone][] = [[100, "gold"], [95, "orange"], [75, "violet"], [50, "blue"], [25, "green"], [0, "grey"]];

/** Each kill and each dummy run against your others of its kind, by your damage a second. */
export function grades(fights: readonly Saved[]): Map<string, Grade> {
  const kinds = new Map<string, Saved[]>();
  for (const f of fights) if (f.you && f.ms >= PROOF && (f.killed || f.dummy)) kinds.set(kind(f), [...(kinds.get(kind(f)) ?? []), f]);
  const all = new Map<string, Grade>();
  for (const list of kinds.values()) {
    const of = list.length - 1;
    if (of < OTHERS) continue;
    for (const f of list) {
      const below = list.filter((o) => o.you!.dps < f.you!.dps).length;
      const same = list.filter((o) => o.you!.dps === f.you!.dps).length - 1;
      const score = below === of ? 100 : Math.min(99, Math.floor(((below + same / 2) / of) * 100));
      all.set(f.id, { score, of, tone: TONES.find(([least]) => score >= least)![1] });
    }
  }
  return all;
}

type Boss = Pick<Target, "code" | "name" | "maxHp">;
/** The same boss with the same health: another difficulty has more. */
const sameBoss = (f: Saved, b: Boss) =>
  !f.dummy && (b.code ? f.code === b.code : f.target === b.name) && f.maxHp > 0 && Math.abs(f.maxHp - b.maxHp) <= b.maxHp * 0.02;

/** Your fastest kill of it. */
export const bestKill = (fights: readonly Saved[], boss: Boss): Saved | undefined =>
  fights.filter((f) => f.killed && f.ms >= PROOF && sameBoss(f, boss)).reduce<Saved | undefined>((best, f) => (best && best.ms <= f.ms ? best : f), undefined);

const MARKS = 8;
/** Where your earlier pulls of it ended, as parts of its health, the newest first. */
export const wipes = (fights: readonly Saved[], boss: Boss): number[] =>
  fights
    .filter((f) => !f.killed && sameBoss(f, boss) && (f.left ?? -1) > 0)
    .slice(0, MARKS)
    .map((f) => f.left! / f.maxHp);

/** A kill as points: when, and how much of its health was left. */
export type Trail = readonly { ms: number; share: number }[];

export function trail(kill: Pick<Saved, "health" | "maxHp" | "ms">): Trail {
  const said = (kill.health ?? []).flatMap((h, s) => (h < 0 ? [] : [{ ms: (s + 1) * 1000, share: h / kill.maxHp }])).filter((p) => p.ms < kill.ms);
  return said.length ? [{ ms: 0, share: 1 }, ...said, { ms: kill.ms, share: 0 }] : [];
}

const between = (from: number, to: number, part: number) => from + (to - from) * part;

/** How much of its health was left then, in that kill. */
export function shareAt(points: Trail, ms: number): number | undefined {
  if (!points.length) return undefined;
  const at = points.findIndex((p) => p.ms >= ms);
  if (at < 0) return 0;
  if (at === 0) return points[0].share;
  const [a, b] = [points[at - 1], points[at]];
  return between(a.share, b.share, (ms - a.ms) / Math.max(1, b.ms - a.ms));
}

/** When so much of it was left in that kill, for the first time. */
export function timeAt(points: Trail, share: number): number | undefined {
  const at = points.findIndex((p) => p.share <= share);
  if (at < 0) return undefined;
  if (at === 0) return points[0].ms;
  const [a, b] = [points[at - 1], points[at]];
  return a.share > b.share ? between(a.ms, b.ms, (a.share - share) / (a.share - b.share)) : b.ms;
}

/** +0:12 is ahead of it, -0:07 behind. */
export function apart(ms: number): string {
  const s = Math.round(Math.abs(ms) / 1000);
  return `${ms < 0 && s ? "-" : "+"}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface Split {
  /** The boss, and which time it was fought in the run. */
  key: string;
  name: string;
  /** From the first pull, in ms. */
  at: number;
}

/** When each boss fell in a run. */
export function splits(fights: readonly Saved[]): Split[] {
  const order = [...fights].filter((f) => !f.dummy).sort((a, b) => a.start - b.start);
  const times = new Map<string, number>();
  return order.filter((f) => f.killed).map((f) => {
    const boss = String(f.code || f.target);
    const n = (times.get(boss) ?? 0) + 1;
    times.set(boss, n);
    return { key: `${boss} ${n}`, name: f.target, at: f.start + f.ms - order[0].start };
  });
}

/** Your best run of a dungeon: of those with the most kills, the shortest to the last of them. */
export function bestRun(runs: readonly Run[], dungeon: number, not?: number): Run | undefined {
  const all = runs.filter((r) => r.dungeon === dungeon && r.run !== not && r.kills > 0);
  const most = Math.max(0, ...all.map((r) => r.kills));
  const end = (r: Run) => splits(r.fights).at(-1)?.at ?? Infinity;
  return all.filter((r) => r.kills === most).reduce<Run | undefined>((best, r) => (best && end(best) <= end(r) ? best : r), undefined);
}

export interface SplitLine {
  key: string;
  name: string;
  /** Nothing while it stands. */
  at?: number;
  best?: number;
}

/** This run beside the best one, in the order of this run, then of what is left of that one. */
export function beside(now: readonly Split[], best: readonly Split[]): SplitLine[] {
  const before = new Map(best.map((s) => [s.key, s.at]));
  const done = new Set(now.map((s) => s.key));
  return [...now.map((s) => ({ ...s, best: before.get(s.key) })), ...best.filter((s) => !done.has(s.key)).map(({ key, name, at }) => ({ key, name, best: at }))];
}

const SHORTEST_RUN = 120_000;
const RUNS = 10;
/** How long a run of yours takes, from going in to the last hit, by your last ones. Nothing before there are three. `runs` newest first. */
export function runTime(runs: readonly Run[]): number | undefined {
  const long = (r: Run) => Math.max(r.ms, Math.max(...r.fights.map((f) => f.start + f.ms)) - r.run);
  const list = runs.filter((r) => r.kills > 0).map(long).filter((ms) => ms >= SHORTEST_RUN && ms < 4 * 3_600_000).slice(0, RUNS);
  return list.length >= 3 ? median(list) : undefined;
}

/** A burst is this far above your average, over as many seconds. */
const BURST = 1.5;
const WIDTH = 5;
/** The game does not say how long a target stays broken: what comes this soon after counts. */
export const BROKEN = 10_000;

export interface Burst {
  /** Of all your damage, the part done in bursts. */
  share: number;
  /** Of that, the part under a passing buff of someone else's, and the part just after a stagger break. Nothing when there was none. */
  buffed?: number;
  broken?: number;
}

/** Whether your bursts came at the right time. Nothing when there was nothing to time them by. */
export function burst(fight: Saved): Burst | undefined {
  const { curve = [], ms, you } = fight;
  if (!you || ms < PROOF || curve.length < WIDTH * 2) return undefined;
  const total = curve[curve.length - 1];
  const average = total / curve.length;
  const high = new Set<number>();
  pace(curve, WIDTH).forEach((p, s) => {
    if (s >= WIDTH - 1 && p > average * BURST) for (let i = s - WIDTH + 1; i <= s; i++) high.add(i);
  });
  const others = (fight.buffs ?? []).filter((b) => !b.passive && b.on === you.id && b.by !== you.id && b.up < ms * 0.9).flatMap((b) => b.spans);
  const breaks = (fight.stagger ?? []).filter((w) => w.broke && w.end < ms);
  if (!total || !high.size || (!others.length && !breaks.length)) return undefined;
  const sum = (counts: (at: number) => boolean) => [...high].reduce((n, s) => n + (counts(s * 1000 + 500) ? curve[s] - (curve[s - 1] ?? 0) : 0), 0);
  const all = sum(() => true);
  if (all <= 0) return undefined;
  return {
    share: all / total,
    ...(others.length && { buffed: sum((at) => others.some(([from, to]) => at >= from && at < to)) / all }),
    ...(breaks.length && { broken: sum((at) => breaks.some((w) => at >= w.end && at < w.end + BROKEN)) / all }),
  };
}

const percent = (part: number) => `${Math.round(part * 100)}%`;
/** That in words. */
export function burstText(b: Burst): string {
  const parts = [
    b.buffed === undefined ? "" : `${percent(b.buffed)} of it under someone else's buff`,
    b.broken === undefined ? "" : `${percent(b.broken)} of it in the ${BROKEN / 1000} s after a stagger break`,
  ];
  return `Bursts: ${percent(b.share)} of your damage, ${parts.filter(Boolean).join(", ")}.`;
}

export interface Best {
  skill: number;
  name: string;
  amount: number;
  /** The fight it was in. */
  id: string;
  target: string;
  start: number;
}

/** Ranks of one skill have different numbers and one name. */
export const skillKey = (skill: { code: number; name: string }) => skill.name || String(skill.code);

/** Your biggest hit with each skill, on no dummy, the biggest first. */
export function records(fights: readonly Saved[]): Best[] {
  const all = new Map<string, Best>();
  for (const f of fights) {
    if (f.dummy) continue;
    for (const [skill, name, amount] of f.you?.big ?? []) {
      const key = skillKey({ code: skill, name });
      if (amount > (all.get(key)?.amount ?? 0)) all.set(key, { skill, name, amount, id: f.id, target: f.target, start: f.start });
    }
  }
  return [...all.values()].sort((a, b) => b.amount - a.amount);
}

export interface Fastest {
  kill: Saved;
  kills: number;
}

/** Your fastest kill of each boss, the one killed most first. */
export function fastest(fights: readonly Saved[]): Fastest[] {
  const all = new Map<string, Fastest>();
  for (const f of fights) {
    if (!f.killed || f.dummy || f.ms < PROOF) continue;
    const key = `${f.code || f.target} ${f.maxHp}`;
    const before = all.get(key);
    all.set(key, { kill: before && before.kill.ms <= f.ms ? before.kill : f, kills: (before?.kills ?? 0) + 1 });
  }
  return [...all.values()].sort((a, b) => b.kills - a.kills || a.kill.ms - b.kill.ms);
}

export interface Streak {
  /** How many it is now, and the most there were. */
  now: number;
  most: number;
}

/** How often in a row, the newest first. */
export function streak(list: readonly boolean[]): Streak {
  let [most, run] = [0, 0];
  for (const good of list) most = Math.max(most, (run = good ? run + 1 : 0));
  const end = list.indexOf(false);
  return { now: end < 0 ? list.length : end, most };
}

/** Kills in a row, and pulls without your death. `fights` newest first. */
export function streaks(fights: readonly Saved[]): { kills: Streak; alive: Streak } {
  const pulls = fights.filter((f) => !f.dummy && f.you && f.ms >= PROOF);
  return { kills: streak(pulls.map((f) => f.killed)), alive: streak(pulls.map((f) => f.you!.deaths === 0)) };
}

/** Your total by second, with one more look at the fight. What was not seen is a straight line. */
export function grow(curve: readonly number[], ms: number, total: number): number[] {
  const at = Math.floor(ms / 1000);
  const last = curve.length - 1;
  if (at < last || total < (curve[last] ?? 0)) return grow([], ms, total);
  const from = curve[last] ?? 0;
  const next = curve.slice();
  for (let s = last + 1; s <= at; s++) next[s] = Math.round(between(from, total, (s - last) / (at - last)));
  next[at] = total;
  return next;
}
