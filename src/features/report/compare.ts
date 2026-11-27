// Two fights of yours, held against each other.
import { FLAG, type Entry, type Saved } from "../../live/types.ts";
import { activeDps, casts, gaps, nameOf, opener } from "./logic.ts";

export interface Figure {
  name: string;
  a: number | undefined;
  b: number | undefined;
  kind: "number" | "percent" | "time";
  /** False when less is better. */
  more: boolean;
}

const direct = (list: readonly Entry[] = []) => list.filter((c) => !(c[3] & FLAG.dot));
const share = (list: readonly Entry[], flag: number) => (list.length ? list.filter((c) => c[3] & flag).length / list.length : undefined);

export function figures(a: Saved, b: Saved): Figure[] {
  const of = (name: string, kind: Figure["kind"], more: boolean, get: (f: Saved) => number | undefined): Figure => ({ name, kind, more, a: get(a), b: get(b) });
  const perMinute = (f: Saved) => (f.casts?.length && f.ms ? casts(f.casts).length / (f.ms / 60_000) : undefined);
  return [
    of("Damage a second", "number", true, (f) => f.you?.dps),
    of("The same without time it could not be hit", "number", true, (f) => Math.round(activeDps(f))),
    of("Damage", "number", true, (f) => f.you?.damage),
    of("First 20 s", "number", true, (f) => opener(f)),
    of("Casts a minute", "number", true, perMinute),
    of("Time in gaps", "time", false, (f) => (f.casts?.length ? gaps(f).reduce((s, g) => s + g.to - g.from, 0) : undefined)),
    of("Crit", "percent", true, (f) => share(direct(f.casts), FLAG.crit)),
    of("From behind", "percent", true, (f) => share(direct(f.casts), FLAG.back)),
    of("Damage taken", "number", false, (f) => f.you?.taken),
    of("Deaths", "number", false, (f) => f.you?.deaths),
    of("Time", "time", false, (f) => f.ms),
  ].filter((f) => f.a !== undefined || f.b !== undefined);
}

/** Skills of both, by the damage they gained or lost. */
export function skillGains(a: Saved, b: Saved): { name: string; a: number; b: number }[] {
  const by = new Map<string, { name: string; a: number; b: number }>();
  for (const side of ["a", "b"] as const) {
    const fight = side === "a" ? a : b;
    for (const s of fight.you?.skills ?? []) {
      const name = s.name || nameOf(fight, s.code);
      const row = by.get(name) ?? { name, a: 0, b: 0 };
      // For each second, so that a longer fight is not a better one.
      row[side] += s.damage / Math.max(1, fight.ms / 1000);
      by.set(name, row);
    }
  }
  return [...by.values()].sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a));
}

/** Stats that are not the same. The game numbers them; only these two are known. */
const STATS: Record<string, string> = { 215: "Cooldown reduction", 385: "Cooldown increase" };
export const statName = (id: string) => STATS[id] ?? `Stat ${id}`;

export function statChanges(a: Saved, b: Saved): { id: string; name: string; a: number; b: number }[] {
  if (!Object.keys(a.stats ?? {}).length || !Object.keys(b.stats ?? {}).length) return [];
  const ids = new Set([...Object.keys(a.stats!), ...Object.keys(b.stats!)]);
  return [...ids]
    .map((id) => ({ id, name: statName(id), a: a.stats![id] ?? 0, b: b.stats![id] ?? 0 }))
    .filter((s) => s.a !== s.b)
    .sort((x, y) => Number(x.id) - Number(y.id));
}

export interface Luck {
  /** Damage a second as it was. */
  a: number;
  b: number;
  /** As it would be with the same share of crits in both. */
  evenA: number;
  evenB: number;
  /** How much of the gain is luck and how much is real, as shares of `a`. */
  luck: number;
  real: number;
  /** The real gain is more than two runs alike could differ by chance. */
  sure: boolean;
}

/** How much of the change from `a` to `b` is crit luck. Nothing with too few hits to say. */
export function luck(a: Saved, b: Saved): Luck | undefined {
  const runs = [a, b].map((f) => ({ f, hits: direct(f.casts) }));
  if (runs.some((r) => r.hits.length < 30 || !r.f.you)) return undefined;
  const skills = new Set(runs.flatMap((r) => r.hits.map((h) => h[1])));
  const even = [0, 0];
  const wobble = [0, 0];
  for (const skill of skills) {
    const own = runs.map((r) => r.hits.filter((h) => h[1] === skill));
    const pooled = own.flat();
    const crits = pooled.filter((h) => h[3] & FLAG.crit);
    const p = crits.length / pooled.length;
    own.forEach((hits, i) => {
      const mean = (list: Entry[], other: Entry[]) => {
        const from = list.length ? list : other;
        return from.length ? from.reduce((s, h) => s + h[2], 0) / from.length : 0;
      };
      const big = mean(hits.filter((h) => h[3] & FLAG.crit), crits);
      const small = mean(hits.filter((h) => !(h[3] & FLAG.crit)), pooled.filter((h) => !(h[3] & FLAG.crit)));
      const [c, n] = [big || small, small || big];
      even[i] += hits.length * (p * c + (1 - p) * n);
      wobble[i] += hits.length * p * (1 - p) * (c - n) ** 2;
    });
  }
  const [ta, tb] = runs.map((r) => Math.max(1, r.f.ms / 1000));
  // Damage over time is left as it was.
  const ticks = runs.map((r) => (r.f.casts ?? []).filter((c) => c[3] & FLAG.dot).reduce((s, c) => s + c[2], 0));
  const actual = runs.map((r, i) => (r.hits.reduce((s, h) => s + h[2], 0) + ticks[i]) / (i ? tb : ta));
  const [evenA, evenB] = [(even[0] + ticks[0]) / ta, (even[1] + ticks[1]) / tb];
  const noise = Math.sqrt(wobble[0] / ta ** 2 + wobble[1] / tb ** 2);
  const real = evenB - evenA;
  return {
    a: actual[0], b: actual[1], evenA, evenB,
    luck: (actual[1] - actual[0] - real) / actual[0],
    real: real / actual[0],
    sure: Math.abs(real) > 2 * noise * 0.5,
  };
}
