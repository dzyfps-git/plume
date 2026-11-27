import { createEffect, createRoot, createSignal, untrack } from "solid-js";
import { entries, near, place, sampling } from "../../live/store";
import { NO_ENTRIES, type Entries } from "../../live/types";
import type { Kept } from "./logic";

/** Each character as last seen, by name, on this PC. Yours alone. */
const KEY = "characters";
function read(): Record<string, Kept> {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "null") as Record<string, Kept> | null) ?? {};
  } catch {
    return {};
  }
}
const [kept, setKept] = createSignal<Record<string, Kept>>(read());
export { kept };
// The other window's.
addEventListener("storage", (e) => e.key === KEY && setKept(read()));

function save(next: Record<string, Kept>) {
  setKept(next);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export const forget = (name: string) => {
  const { [name]: _, ...rest } = kept();
  save(rest);
};

const counts = (e: Entries) => ({ counts: e.counts, duty: e.duty, points: e.points, kinah: e.kinah, shop: e.shop ?? [], crafts: e.crafts ?? [] });

/** Keeps the character you play as its numbers change. */
export function followCharacters() {
  createRoot(() => {
    // Your name, energy and stats come together; entries and where you are come apart, after a switch of character.
    // Those heard before the switch were the character before's, and are not kept under the new name.
    let who = "";
    let before: { entries?: Entries; place?: ReturnType<typeof place> } = {};
    // The entries last kept: a map or Odyle change runs this again with the same entries, which were not read again.
    let last: Entries | undefined;
    createEffect(() => {
      const you = near.you;
      if (sampling() || !you?.name) return;
      const [e, p, odyle, stats] = [entries(), place(), [...near.odyle] as Kept["odyle"], { power: you.power, level: you.level }];
      untrack(() => {
        if (you.name !== who) {
          if (who) before = { entries: e, place: p };
          who = you.name;
        }
        const was = kept()[you.name];
        const fresh = e !== before.entries;
        const read = fresh && e !== last ? Date.now() : was?.read;
        last = e;
        const map = (p !== before.place && p?.map) || was?.map || 0;
        // What is not said yet for this character stays as it was.
        const said = fresh ? counts(e) : was ? {} : counts(NO_ENTRIES);
        const next: Kept = { ...was, name: you.name, job: you.job, at: was?.at ?? Date.now(), read, odyle, ...said, map, power: stats.power || was?.power || 0, level: stats.level || was?.level || 0 } as Kept;
        const same = was && JSON.stringify({ ...was, at: 0 }) === JSON.stringify({ ...next, at: 0 });
        if (!same) save({ ...kept(), [you.name]: { ...next, at: Date.now() } });
      });
    });
  });
}
