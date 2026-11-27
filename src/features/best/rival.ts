// Your best kill of the boss that is fought now, whole, to race against.
import { createEffect, createMemo, createRoot, createSignal } from "solid-js";
import { fight as loadFight } from "../../api";
import { fight, shownId } from "../../live/store";
import type { Saved } from "../../live/types";
import { followFights, fights } from "../history/store";
import { bestKill, trail, wipes } from "./logic";

const [rival, setRival] = createSignal<Saved>();
/** Nothing until there is a kill of it. */
export { rival };

let marks: () => number[] = () => [];
let points: () => ReturnType<typeof trail> = () => [];
/** Where earlier pulls of it ended. */
export const earlier = () => marks();
export const rivalTrail = () => points();

let following = false;
export function followRival() {
  if (following) return;
  following = true;
  followFights();
  createRoot(() => {
    const boss = createMemo(() => ({ code: fight.target.code, name: fight.target.name, maxHp: fight.target.boss ? fight.target.maxHp : 0 }), undefined, {
      equals: (a, b) => a.code === b.code && a.name === b.name && a.maxHp === b.maxHp,
    });
    // This fight itself, once it is kept, is no rival of itself while it still shows. Another with the same damage is.
    const others = createMemo(() => fights().filter((f) => f.id !== shownId()));
    const id = createMemo(() => (boss().maxHp > 0 ? bestKill(others(), boss())?.id : undefined));
    createEffect(() => {
      const wanted = id();
      setRival();
      if (wanted) void loadFight(wanted).then((f) => f && id() === wanted && setRival(f), console.error);
    });
    marks = createMemo(() => (boss().maxHp > 0 ? wipes(fights(), boss()) : []));
    points = createMemo(() => (rival() ? trail(rival()!) : []));
  });
}
