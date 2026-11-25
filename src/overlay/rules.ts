import type { Near } from "../live/types.ts";
import type { Rule, When } from "../store/settings.ts";

export const WHEN_NAMES: Record<When, string> = {
  always: "Always",
  fight: "In fights",
  boss: "In boss fights",
  dungeon: "In dungeons",
  pvp: "Against players",
  calm: "Out of fights",
};

/** Whether an overlay may show now. A class that is not known yet keeps nothing hidden. */
export function allowed(rule: Rule, near: Pick<Near, "you" | "target" | "foe" | "fighting" | "dungeon">): boolean {
  const job = near.you?.job ?? "";
  if (rule.job && job && rule.job !== job) return false;
  return {
    always: true,
    fight: near.fighting,
    boss: near.fighting && !!near.target?.boss,
    dungeon: near.dungeon > 0,
    pvp: !!near.foe,
    calm: !near.fighting,
  }[rule.when];
}
