import { createEffect, createSignal, on, Show, untrack } from "solid-js";
import { near, onHappened, sampling } from "../../live/store";
import { full } from "../../ui/format";
import { count, hold, NONE, resume, stale, type Tally } from "./logic";
import "../meter/meter.css";
import "./pvp.css";

const [tally, setTally] = createSignal(NONE);
export { tally };

/** Your own counts alone, on this PC: the overlay window closes as it sleeps. */
const KEY = "pvp";
/** When the count last changed. */
let at = Date.now();
function kept() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { at?: unknown } | null;
    if (typeof saved?.at === "number") at = saved.at;
    return resume(saved, Date.now());
  } catch {
    return NONE;
  }
}

/** Counts with `step`, on a new count when the last change is six hours old: also while the overlay stays open. */
function add(step: (t: Tally) => Tally) {
  const old = stale(at, Date.now());
  const t = old ? NONE : tally();
  const next = step(t);
  if (next === t) return;
  if (old) localStorage.removeItem(KEY);
  setTally(next);
}

/** Counts for as long as the overlay window is open, and goes on from where it was. */
export function followPvp() {
  setTally(kept());
  createEffect(on(tally, (tally) => {
    at = Date.now();
    localStorage.setItem(KEY, JSON.stringify({ at, tally }));
  }, { defer: true }));
  const seen = new Map<string, number>();
  onHappened((h) => add((t) => count(t, h)));
  createEffect(() => {
    const auras = sampling() ? [] : near.you?.auras.map((a) => ({ ...a })) ?? [];
    untrack(() => add((t) => hold(t, auras, seen)));
  });
}

export function PvpOverlay() {
  return (
    <section class="pvp glass" aria-label="PvP">
      <div><b class="ui-num">{tally().kills}</b><small>kills</small></div>
      <div><b class="ui-num">{tally().deaths}</b><small>deaths</small></div>
      <div><b class="ui-num">{tally().assists}</b><small>assists</small></div>
      <div data-streak={tally().streak > 1 || undefined}><b class="ui-num">{tally().streak}</b><small>in a row, best {tally().best}</small></div>
      <p class="ui-num">
        <Show when={tally().points} fallback="No Abyss Points yet">
          {full(tally().points)} Abyss Points{tally().last ? `, ${full(tally().last)} for the last kill` : ""}
        </Show>
      </p>
      <Show when={tally().held}>
        <p class="ui-num">Held {tally().held} {tally().held === 1 ? "time" : "times"}, {(tally().heldMs / 1000).toFixed(1)} s by players</p>
      </Show>
    </section>
  );
}
