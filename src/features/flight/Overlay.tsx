import { Show } from "solid-js";
import { near } from "../../live/store";
import { clock } from "../../ui/format";
import { Drawn } from "../../ui/icons";
import { ticking } from "../../ui/now";
import { air } from "./logic";
import "../meter/meter.css";
import "./flight.css";

export function FlightOverlay() {
  const now = ticking();
  return (
    <section class="flight glass" aria-label="Flight time">
      <Show when={near.flight} fallback={<div class="flight-line"><span><Drawn name="wing" /> Flight</span><b class="ui-num">0:42</b></div>}>
        {(f) => {
          const a = () => air(f(), now());
          return (
            <>
              <div class="flight-line">
                <span><Drawn name="wing" /> {a().flying ? "Flying" : a().ms === undefined ? "Flight" : "Full in"}</span>
                <b class="ui-num">{a().ms === undefined ? Math.round(a().now) : clock(a().ms!)}</b>
              </div>
              <Show when={a().share !== undefined}>
                <div class="flight-bar" data-low={(a().flying && a().share! < 0.2) || undefined} style={{ "--length": a().share }}><i /></div>
              </Show>
            </>
          );
        }}
      </Show>
    </section>
  );
}
