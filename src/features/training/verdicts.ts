import { createMemo, createResource } from "solid-js";
import { fight as loadFight } from "../../api";
import type { Saved } from "../../live/types";
import { unclean } from "../report/deep";

/** What kept each run from being clean, by run. The list does not hold casts, so each is read whole, once. */
const judged = new Map<string, string[]>();
const run = (f: Pick<Saved, "id" | "ms">) => `${f.id} ${f.ms}`;
/** The newest runs are looked at, so many. */
export const SHOWN = 20;

/** Nothing for a run without its hits. `runs` newest first. */
export function verdicts(runs: () => readonly Saved[]): (f: Pick<Saved, "id" | "ms">) => string[] | undefined {
  const listed = createMemo(() => runs().slice(0, SHOWN));
  const [known] = createResource(listed, async (list) => {
    for (const f of list.filter((f) => !judged.has(run(f)))) {
      const whole = await loadFight(f.id).catch(() => null);
      if (whole?.casts?.length) judged.set(run(f), unclean(whole));
    }
    return new Map(judged);
  });
  return (f) => known.latest?.get(run(f));
}
