import type { Aura, Happened } from "../../live/types.ts";
import { CONTROL } from "../effects/logic.ts";

export interface Tally {
  kills: number;
  assists: number;
  deaths: number;
  points: number;
  /** Kills since your last death, and the best of those. */
  streak: number;
  best: number;
  /** Points that came with the last kill. */
  last: number;
  killedAt: number;
  /** Control effects other players put on you, and how long they held you in ms. */
  held: number;
  heldMs: number;
}

export const NONE: Tally = { kills: 0, assists: 0, deaths: 0, points: 0, streak: 0, best: 0, last: 0, killedAt: 0, held: 0, heldMs: 0 };

/** A break this long begins a new count. */
const BREAK = 6 * 3_600_000;
/** The count last changed at `at`, so long ago that it begins anew. */
export const stale = (at: number, now: number) => !(now - at >= 0 && now - at < BREAK);

/** The count as it was kept at a time, or none when that is too long ago or not a count. */
export function resume(kept: unknown, now: number): Tally {
  const { at, tally } = (kept ?? {}) as { at?: unknown; tally?: Record<string, unknown> };
  if (!tally || typeof at !== "number" || stale(at, now)) return NONE;
  const whole = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const keys = Object.keys(NONE) as (keyof Tally)[];
  return keys.every((k) => whole(tally[k])) ? (Object.fromEntries(keys.map((k) => [k, tally[k]])) as unknown as Tally) : NONE;
}

/** Points come just after the kill they are for. */
const WITH = 3_000;

export function count(t: Tally, h: Pick<Happened, "what" | "at" | "amount">): Tally {
  if (h.what === "kill") {
    const streak = t.streak + 1;
    return { ...t, kills: t.kills + 1, streak, best: Math.max(t.best, streak), killedAt: h.at, last: 0 };
  }
  if (h.what === "assist") return { ...t, assists: t.assists + 1 };
  if (h.what === "death") return { ...t, deaths: t.deaths + 1, streak: 0 };
  if (h.what === "points") return { ...t, points: t.points + h.amount, last: Math.abs(h.at - t.killedAt) <= WITH ? t.last + h.amount : t.last };
  return t;
}

/** Counts a control effect once. `seen` remembers which were, by when they began. */
export function hold(t: Tally, auras: readonly Pick<Aura, "key" | "tag" | "foe" | "start" | "end">[], seen: Map<string, number>): Tally {
  let next = t;
  for (const a of auras) {
    if (!a.foe || !(a.tag in CONTROL)) continue;
    const before = seen.get(a.key);
    if (before === a.start) continue;
    seen.set(a.key, a.start);
    next = { ...next, held: next.held + 1, heldMs: next.heldMs + Math.max(0, a.end - a.start) };
  }
  return next;
}
