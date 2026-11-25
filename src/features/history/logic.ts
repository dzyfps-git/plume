import type { Saved } from "../../live/types";

export type Filter = "all" | "bosses" | "kills" | "dummies";

export function filtered(fights: readonly Saved[], filter: Filter, search: string): Saved[] {
  const words = search.trim().toLowerCase();
  return fights.filter(
    (f) =>
      (filter === "all" || (filter === "dummies" ? f.dummy : !f.dummy && (filter === "bosses" || f.killed))) &&
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
