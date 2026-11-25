import { createEffect, createRoot, createSignal, untrack } from "solid-js";
import { entries, near, sampling } from "../../live/store";
import { note, type Seen } from "./logic";

/** How each entry grew, on this PC. Yours alone, and nothing but numbers. */
const KEY = "grown";
function kept(): Record<string, Seen> {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "null") as Record<string, Seen> | null) ?? {};
  } catch {
    return {};
  }
}
const [seen, setSeen] = createSignal<Record<string, Seen>>(kept());
/** By the entry's number, and "odyle". */
export { seen };
// The other window's.
addEventListener("storage", (e) => e.key === KEY && setSeen(kept()));

/** Watches what comes back, so that the next is known. */
export function followGrowth() {
  createRoot(() => {
    let before: Record<string, number> = {};
    createEffect(() => {
      if (sampling()) return;
      const now: Record<string, number> = Object.fromEntries(entries().counts.map(([id, n]) => [String(id), n]));
      if (near.odyle[0] >= 0) now.odyle = near.odyle[0];
      untrack(() => {
        const next = { ...seen() };
        for (const [id, n] of Object.entries(now)) if (n !== before[id]) next[id] = note(next[id], before[id], n, Date.now());
        if (JSON.stringify(next) !== JSON.stringify(seen())) {
          setSeen(next);
          localStorage.setItem(KEY, JSON.stringify(next));
        }
        before = { ...before, ...now };
      });
    });
  });
}
