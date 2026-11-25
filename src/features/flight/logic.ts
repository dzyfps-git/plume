import type { Flight } from "../../live/types.ts";

export interface Air {
  now: number;
  /** 0 to 1. Nothing when the most is not known. */
  share?: number;
  /** Until it is empty while flying, else until it is full. Nothing when that is not known or not coming. */
  ms?: number;
  flying: boolean;
}

/** Flight power now, from what was said last and how fast it changes. */
export function air(f: Flight, at: number): Air {
  const rate = f.flying ? -f.out : f.back;
  const most = f.max > 0 ? f.max : Infinity;
  const now = Math.max(0, Math.min(most, f.now + (rate * Math.max(0, at - f.at)) / 1000));
  const share = f.max > 0 ? now / f.max : undefined;
  const ms = f.flying ? (f.out > 0 ? (now / f.out) * 1000 : undefined) : f.back > 0 && f.max > 0 && now < f.max ? ((f.max - now) / f.back) * 1000 : undefined;
  return { now, share, ms, flying: f.flying };
}
