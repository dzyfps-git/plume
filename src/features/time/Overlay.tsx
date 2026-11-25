import { For, Show } from "solid-js";
import { settings } from "../../store";
import { clock } from "../../ui/format";
import { ticking } from "../../ui/now";
import { resets, wait } from "../resources/logic";
import { elapsed, serverTime, upcoming } from "./logic";
import "../resources/resources.css";

/** A slim bar: the server's time, the next events, the reset, and the stopwatch while it is used. */
export function TimeOverlay() {
  const now = ticking();
  const c = () => settings.clock;
  return (
    <section class="left-strip glass ui-num" aria-label="Time bar">
      <b>{serverTime(now())}</b>
      <For each={upcoming(now(), settings.events.off).slice(0, 2)}>
        {(n) => <span>{n.event.name} <span class="ui-muted">{n.open ? "open" : wait(n.start - now())}</span></span>}
      </For>
      <Show when={c().start}><span><span class="ui-icon" aria-hidden="true">{"\ue916"}</span> {clock(elapsed(c(), now()))}</span></Show>
      <Show when={c().end > now()}><span><span class="ui-icon" aria-hidden="true">{"\ue121"}</span> {clock(c().end - now())}</span></Show>
      <span class="left-reset">resets in {wait(resets(now()).daily)}</span>
    </section>
  );
}
