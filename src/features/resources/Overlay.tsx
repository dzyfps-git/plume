import { createSignal, onCleanup, Show } from "solid-js";
import { entries, live, near } from "../../live/store";
import { settings } from "../../store";
import { Feet } from "../meter/Foot";
import { resets, strip, wait } from "./logic";
import "../meter/meter.css";
import "./resources.css";

export const shown = () => strip(entries(), near.odyle, settings.resources, settings.odyleRun);

/** The time, twice a minute. */
export function minutes() {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 30_000);
  onCleanup(() => clearInterval(timer));
  return now;
}

/** Popped out of the meter, it always shows. */
export const bare = () => near.odyle[0] < 0 && !shown().length && !(settings.odyle.place === "out" && live());

export function ResourcesOverlay() {
  const now = minutes();
  return (
    <section class="left-strip glass ui-num" aria-label="Odyle and tickets">
      <Feet of={["odyle", "entries"]} class="left-feet" />
      <Show when={bare()}><span>Odyle and tickets</span></Show>
      <span class="left-reset">resets in {wait(resets(now()).daily)}</span>
    </section>
  );
}
