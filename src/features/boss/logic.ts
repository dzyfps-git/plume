import type { Fight } from "../../live/types";

/** What is left of the target. Without a reading, what was dealt is taken off what it had. */
export function hp(fight: Pick<Fight, "target" | "total">): number {
  const { hp, maxHp } = fight.target;
  return Math.max(0, Math.min(maxHp, hp >= 0 ? hp : maxHp - fight.total));
}

/** Milliseconds until it falls at the fight's pace. Nothing in the first seconds, when the pace says little. */
export function timeLeft(fight: Pick<Fight, "target" | "total" | "ms">): number | undefined {
  const left = hp(fight);
  if (fight.ms < 5000 || fight.total <= 0 || left <= 0) return undefined;
  const ms = (left / fight.total) * fight.ms;
  return ms < 3_600_000 ? ms : undefined;
}
