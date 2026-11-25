import type { Settings } from "../store/settings.ts";
import type { Fight } from "./types.ts";

/** Whether a fight takes the place of the one that is shown. A dummy does: you went to it on purpose. */
export function worth(next: Pick<Fight, "rows" | "target" | "dungeon">, only: Settings["fights"]["only"]): boolean {
  if (!only || next.target.dummy) return true;
  // Leaving the dungeon empties the fight, and the last boss is to stay.
  if (!next.rows.length) return only === "boss";
  return next.target.boss && (only === "boss" || next.dungeon > 0);
}

/** A fight is over this long after its last hit, in ms. One that fell is over soon. */
const FELL = 5_000;
export const limit = (target: Pick<Fight["target"], "boss" | "hp" | "maxHp">, fights: Pick<Settings["fights"], "end" | "bossEnd">) =>
  target.maxHp > 0 && target.hp === 0 ? FELL : (target.boss ? fights.bossEnd : fights.end) * 1000;
