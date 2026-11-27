import type { Near } from "../live/types.ts";
import { GROUP } from "../features/frames/logic.ts";
import type { Activity, Layout, Rule, Settings, When } from "../store/settings.ts";

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

/** A fight for the overlays: the game says so, or a hit by you or the party was this recent, and then `linger` seconds more. */
export function inFight(by: Settings["overlay"]["fightBy"], game: boolean, lastAt: number, now: number, linger: number): boolean {
  if (by === "game" && game) return true;
  const after = (by === "game" ? 0 : HIT_HOLDS) + linger * 1000;
  return lastAt > 0 && now - lastAt < after;
}

/** A hit keeps a fight on for this long. */
export const HIT_HOLDS = 5_000;

/** What you are doing now, for layouts: against a player, on a dummy, in a Force, a party, or alone. */
export function activity(near: Pick<Near, "foe" | "party">, dummy: boolean): Activity {
  if (near.foe) return "pvp";
  if (dummy) return "dummy";
  const others = near.party.filter((u) => !u.you).length;
  return others >= GROUP ? "force" : others > 0 ? "party" : "solo";
}

/** The layout that fits best: of this character and activity, then of the character, then of the activity. One for neither is chosen by hand. */
export function pick(layouts: readonly Layout[], now: Activity, who: string): Layout | undefined {
  const score = (l: Layout) => {
    if ((l.who && l.who !== who) || (l.when && l.when !== now) || (!l.who && !l.when)) return 0;
    return (l.who ? 2 : 0) + (l.when ? 1 : 0);
  };
  return [...layouts].sort((a, b) => score(b) - score(a)).find((l) => score(l) > 0);
}
