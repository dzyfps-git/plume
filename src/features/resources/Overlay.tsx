import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { entries, near } from "../../live/store";
import { settings } from "../../store";
import { Thing, type ThingName } from "../../ui/icons";
import { counted, resets, strip, wait } from "./logic";
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

export function ResourcesOverlay() {
  const now = minutes();
  const list = createMemo(shown);
  return (
    <section class="left-strip glass ui-num" aria-label="Resources">
      <For each={list()} fallback={<span>Resources</span>}>
        {(l) => <span aria-label={l.name}><Show when={l.kind} fallback={l.name}>{(kind) => <Thing of={kind() as ThingName} />}</Show> <b>{l.value}</b><Show when={l.more}><span class="bonus">{l.more}</span></Show><Show when={l.runs !== undefined}><em>{counted(l.runs!, "run")}</em></Show></span>}
      </For>
      <span class="left-reset">resets in {wait(resets(now()).daily)}</span>
    </section>
  );
}
