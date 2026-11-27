import { createEffect, createRoot, createSignal, untrack } from "solid-js";
import { entries, near, onLoot, sampling } from "../../live/store";
import type { LootEvent } from "../../live/types";
import { count, dayOf, emptyDay, kinahSaid, redact, rolled, type Day, type Roll } from "./logic";

/** On this PC, yours alone: the days kept, newest first, and the Dice Rolls. */
const DAYS = "loot-days";
const ROLLS = "rolls";
const MOST_DAYS = 60;

function read<T>(key: string, empty: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T | null) ?? empty;
  } catch {
    return empty;
  }
}
const [days, setDays] = createSignal<Day[]>(read(DAYS, []));
// Rolls kept before names were left out lose them now.
const [rolls, setRolls] = createSignal<Roll[]>(read<Roll[]>(ROLLS, []).map(redact));
export { days, rolls };
// The other window's.
addEventListener("storage", (e) => {
  if (e.key === DAYS) setDays(read(DAYS, []));
  if (e.key === ROLLS) setRolls(read<Roll[]>(ROLLS, []).map(redact));
});

function keep(change: (d: Day) => Day, at: number) {
  const start = dayOf(at);
  const all = days();
  // The day of the event, which is not always the newest: one can come late, after the reset.
  const today = all.find((d) => d.start === start) ?? emptyDay(start);
  const next = change(today);
  if (next === today && all.includes(today)) return;
  const list = [next, ...all.filter((d) => d.start !== start)].sort((a, b) => b.start - a.start).slice(0, MOST_DAYS);
  setDays(list);
  localStorage.setItem(DAYS, JSON.stringify(list));
}

/** Items gained just now, for the loot feed. Not kept. */
const [fresh, setFresh] = createSignal<{ n: number; item: number; count: number; at: number }[]>([]);
export { fresh };
let counted = 0;
const SHOWN = 8_000;
function feed(e: LootEvent) {
  if (e.kind !== "items") return;
  const got = e.items.map((i) => ({ item: i.item, count: i.gained ?? (i.change === "new" ? i.total : 0) })).filter((i) => i.count > 0);
  if (!got.length) return;
  const now = Date.now();
  setFresh((all) => [...all.filter((f) => now - f.at < SHOWN), ...got.map((g) => ({ ...g, n: ++counted, at: now }))].slice(-8));
  setTimeout(() => setFresh((all) => all.filter((f) => Date.now() - f.at < SHOWN)), SHOWN + 100);
}

/** Keeps loot and rolls as they come. `chosen` hears each item gained. */
export function followLoot(chosen?: (item: number) => void) {
  // Loot comes only from the game, so it is kept while overlays are placed too. Only the feed and the alerts wait.
  onLoot((m) => {
    if (m.t === "rolls") {
      let all = rolls();
      for (const e of m.events) all = rolled(all, e);
      setRolls(all);
      // Names are never written down: other players are numbers in what is kept.
      localStorage.setItem(ROLLS, JSON.stringify(all.map(redact)));
      return;
    }
    for (const e of m.events) {
      keep((d) => count(d, e), e.at);
      if (sampling()) continue;
      feed(e);
      if (e.kind === "items") for (const i of e.items) if ((i.gained ?? (i.change === "new" ? i.total : 0)) > 0) chosen?.(i.item);
    }
  });
  createRoot(() => {
    // Each launch and each character starts again from what the game says first: only what grows while seen is gained.
    // After a switch, the entries heard before it are the character before's: their Kinah waits for the game's next word.
    let who: string | undefined;
    let fresh = true;
    let stale: ReturnType<typeof entries> | undefined;
    createEffect(() => {
      const [e, name] = [entries(), near.you?.name ?? ""];
      if (sampling() || e.kinah < 0) return;
      untrack(() => {
        if (who !== name) {
          if (who !== undefined) stale = e;
          who = name;
          fresh = true;
        }
        if (e === stale) return;
        keep((d) => kinahSaid(d, e.kinah, fresh), Date.now());
        fresh = false;
      });
    });
  });
}
