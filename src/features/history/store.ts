import { createMemo, createRoot, createSignal } from "solid-js";
import { fight as whole, fights as load, on } from "../../api";
import type { Saved } from "../../live/types";
import { grades, runTime } from "../best/logic";
import { runs } from "./logic";

const [fights, setFights] = createSignal<Saved[]>([]);
export { fights };

/** Your dungeon runs, how long one takes, and the grade of each fight. */
export const allRuns = createRoot(() => createMemo(() => runs(fights())));
export const runMs = createRoot(() => createMemo(() => runTime(allRuns())));
export const allGrades = createRoot(() => createMemo(() => grades(fights())));

const refresh = async () => setFights(await load());

let following = false;
/** Reads the fights the first time a page asks, then after each new one. */
export function followFights() {
  if (following) return;
  following = true;
  void refresh().catch(console.error);
  void on("saved", () => void refresh().catch(console.error));
}

/** Calls `hear` with each fight as it is kept, and all that are. */
export const onKept = (hear: (fight: Saved, all: readonly Saved[]) => void) =>
  void on("saved", ({ id }) => void Promise.all([whole(id), load()]).then(([fight, all]) => fight && hear(fight, all)).catch(console.error));

export const forgetFight = (id: string) => setFights((all) => all.filter((f) => f.id !== id));
