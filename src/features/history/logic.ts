import type { Saved } from "../../live/types.ts";

export type Filter = "all" | "bosses" | "kills" | "dummies" | "runs" | "session" | "table";

export function filtered(fights: readonly Saved[], filter: Filter, search: string): Saved[] {
  const words = search.trim().toLowerCase();
  return fights.filter(
    (f) =>
      (filter === "all" || filter === "session" || filter === "table" || (filter === "runs" ? !!f.run : filter === "dummies" ? f.dummy : !f.dummy && (filter === "bosses" || f.killed))) &&
      (!words || f.target.toLowerCase().includes(words)),
  );
}

/** Fights that can be held against each other: one target, or dummies over about the same time. */
const kind = (f: Saved) => (f.dummy ? `dummy ${Math.round(f.ms / 30_000)}` : `boss ${f.code || f.target}`);

/** The best of each kind by your damage a second. A short fight proves nothing. */
export function bests(fights: readonly Saved[]): Map<string, Saved> {
  const best = new Map<string, Saved>();
  for (const f of fights) {
    if (!f.you || f.ms < 15_000) continue;
    const before = best.get(kind(f));
    if (!before || f.you.dps > before.you!.dps) best.set(kind(f), f);
  }
  return best;
}

/** Fights that can be held against this one, newest first. */
export const alike = (fights: readonly Saved[], f: Saved) => fights.filter((o) => o.id !== f.id && kind(o) === kind(f));

/** A break this long begins a new session. */
const BREAK = 2 * 3_600_000;

/** The fights of the last session, newest first as they come. */
export function session(fights: readonly Saved[]): Saved[] {
  const list: Saved[] = [];
  for (const f of fights) {
    const last = list.at(-1);
    if (last && last.start - (f.start + f.ms) > BREAK) break;
    list.push(f);
  }
  return list;
}

export interface Tries {
  target: string;
  tries: number;
  kills: number;
  /** Your best damage a second. */
  best: number;
  /** The least health a lost pull left, 0 to 1. */
  closest?: number;
  deaths: number;
  ms: number;
}

/** A session boss by boss, the most time first. */
export function tries(fights: readonly Saved[]): Tries[] {
  const all = new Map<string, Tries>();
  for (const f of fights) {
    const t = all.get(f.target) ?? { target: f.target, tries: 0, kills: 0, best: 0, deaths: 0, ms: 0 };
    all.set(f.target, t);
    t.tries++;
    t.kills += f.killed ? 1 : 0;
    t.best = Math.max(t.best, f.you?.dps ?? 0);
    t.deaths += f.you?.deaths ?? 0;
    t.ms += f.ms;
    const left = f.killed || f.dummy || f.maxHp <= 0 || (f.left ?? -1) < 0 ? undefined : f.left! / f.maxHp;
    if (left !== undefined) t.closest = Math.min(t.closest ?? 1, left);
  }
  return [...all.values()].sort((a, b) => b.ms - a.ms);
}

export interface Run {
  id: string;
  run: number;
  dungeon: number;
  /** In the order they were fought. */
  fights: Saved[];
  /** From the first pull to the end of the last. */
  ms: number;
  /** Fighting bosses. */
  fought: number;
  damage: number;
  deaths: number;
  kills: number;
}

/** Dungeon runs, newest first. */
export function runs(fights: readonly Saved[]): Run[] {
  const all = new Map<string, Saved[]>();
  for (const f of fights) if (f.run) all.set(`${f.dungeon} ${f.run}`, [...(all.get(`${f.dungeon} ${f.run}`) ?? []), f]);
  return [...all]
    .map(([id, list]) => {
      const order = [...list].sort((a, b) => a.start - b.start);
      const sum = (of: (f: Saved) => number) => order.reduce((n, f) => n + of(f), 0);
      const last = order[order.length - 1];
      return {
        id, run: order[0].run!, dungeon: order[0].dungeon, fights: order, ms: last.start + last.ms - order[0].start,
        fought: sum((f) => f.ms), damage: sum((f) => f.you?.damage ?? 0), deaths: sum((f) => f.you?.deaths ?? 0), kills: sum((f) => (f.killed ? 1 : 0)),
      };
    })
    .sort((a, b) => b.run - a.run);
}

export const bestOf = (best: Map<string, Saved>, f: Saved) => best.get(kind(f));

export function byDay<T extends { start: number }>(fights: readonly T[], day: (at: number) => string): [string, T[]][] {
  const days = new Map<string, T[]>();
  for (const f of fights) {
    const name = day(f.start);
    days.set(name, [...(days.get(name) ?? []), f]);
  }
  return [...days];
}

/** Damage a second around each second, averaged over `width` seconds, from a total by second. */
export function pace(curve: readonly number[], width = 5): number[] {
  return curve.map((total, i) => {
    const from = Math.max(0, i - width);
    return (total - (i >= width ? curve[from] : 0)) / Math.max(1, Math.min(i + 1, width));
  });
}

/** A line through `values`, in a box `width` by `height`, with `most` at the top and `count` points across. */
export function path(values: readonly number[], width: number, height: number, most: number, count: number): string {
  if (values.length < 2 || most <= 0) return "";
  const step = width / Math.max(1, count - 1);
  return values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(height - (v / most) * height).toFixed(1)}`).join("");
}

/** Your damage a second with buffs counted. Nothing where buffs were not weighed. */
export const rdps = (f: Pick<Saved, "you" | "ms">): number | undefined =>
  f.you?.given === undefined && f.you?.got === undefined ? undefined : (f.you!.damage - (f.you!.got ?? 0) + (f.you!.given ?? 0)) / Math.max(1, f.ms / 1000);
