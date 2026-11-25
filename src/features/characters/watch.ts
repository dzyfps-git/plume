import { createEffect, createRoot, createSignal, untrack } from "solid-js";
import { entries, near, place, sampling } from "../../live/store";
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

/** Keeps the character you play as its numbers change. */
export function followCharacters() {
  createRoot(() => {
    createEffect(() => {
      const you = near.you;
      if (sampling() || !you?.name) return;
      const e = entries();
      const now = { odyle: [...near.odyle] as Kept["odyle"], counts: e.counts, duty: e.duty, points: e.points, kinah: e.kinah, map: place()?.map ?? 0 };
      untrack(() => {
        const was = kept()[you.name];
        // A new character's entries arrive after its name: what is not said yet stays as it was.
        const next: Kept = { ...was, name: you.name, job: you.job, at: was?.at ?? Date.now(), ...now, map: now.map || was?.map || 0 };
        const same = was && JSON.stringify({ ...was, at: 0 }) === JSON.stringify({ ...next, at: 0 });
        if (!same) save({ ...kept(), [you.name]: { ...next, at: Date.now() } });
      });
    });
  });
}
