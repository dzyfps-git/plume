// When your skills come back. The game's traffic does not say it, so it is learned from your own fights.
import type { Job, Saved } from "../../live/types.ts";
import { nameOf, waited } from "../report/logic.ts";

export interface Known {
  skill: number;
  name: string;
  /** About how long it takes to come back, in ms. */
  back: number;
  casts: number;
}

const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Skills with a cooldown, longest first. Only fights of the class you are, when that is known. */
export function learned(fights: readonly Saved[], job: Job): Known[] {
  const all = new Map<number, { name: string; times: number[]; casts: number }>();
  for (const f of fights) {
    if (job && f.you?.job && f.you.job !== job) continue;
    for (const w of waited(f)) {
      const s = all.get(w.skill) ?? { name: nameOf(f, w.skill), times: [], casts: 0 };
      all.set(w.skill, s);
      s.times.push(w.usual);
      s.casts += w.casts;
    }
  }
  return [...all]
    .map(([skill, s]) => ({ skill, name: s.name, back: median(s.times), casts: s.casts }))
    .sort((a, b) => b.back - a.back || a.skill - b.skill);
}

/** From the last cast until it is back. Nothing when it is ready. */
export function cooling(known: Pick<Known, "back">, cast: number | undefined, now: number): { start: number; end: number } | undefined {
  if (cast === undefined || cast + known.back <= now) return undefined;
  return { start: cast, end: cast + known.back };
}
