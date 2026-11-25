import { createSignal, For, Show } from "solid-js";
import { change, settings } from "../../store";
import { clock, full } from "../../ui/format";
import { Line, Slide } from "../../ui/Line";
import { ticking } from "../../ui/now";
import { resets, wait } from "../resources/logic";
import "../resources/resources.css";
import { elapsed, EVENTS, next, odds, serverTime, toggle } from "./logic";

export function TimePage() {
  const now = ticking();
  const c = () => settings.clock;
  const off = (id: string) => settings.events.off.includes(id);
  const flip = (id: string) => change((s) => (s.events.off = off(id) ? s.events.off.filter((k) => k !== id) : [...s.events.off, id]));
  const rows = () => EVENTS.map((e) => next(e, now())).sort((a, b) => a.start - b.start);
  const [chance, setChance] = createSignal(10);
  const [cost, setCost] = createSignal(0);
  const tries = () => odds(chance() / 100);
  return (
    <div class="page">
      <header class="page-head">
        <h1>Time</h1>
        <span class="ui-muted ui-num">Server {serverTime(now())}</span>
      </header>
      <div class="stats">
        <div class="stat"><small>Daily reset in</small><b class="ui-num">{wait(resets(now()).daily)}</b></div>
        <div class="stat"><small>Weekly reset in</small><b class="ui-num">{wait(resets(now()).weekly)}</b></div>
        <div class="stat" data-hero><small>Stopwatch</small><b class="ui-num">{clock(elapsed(c(), now()))}</b></div>
        <Show when={c().end > now()}><div class="stat"><small>Countdown</small><b class="ui-num">{clock(c().end - now())}</b></div></Show>
      </div>

      <section class="block">
        <h2>Events</h2>
        <p class="ui-muted ui-small">On the server's clock, as guides give them: NC has published none, and they differ on Monday. Turned on, they show on the Time bar and the alert An event begins says them.</p>
        <For each={rows()}>
          {(n) => (
            <div class="ui-row-item event-row">
              <button class="ui-chip" aria-pressed={!off(n.event.id)} onClick={() => flip(n.event.id)}>{n.event.name}</button>
              <span class="ui-num" classList={{ "ui-muted": off(n.event.id) }}>{n.open ? "Open now" : `in ${wait(n.start - now())}`}</span>
              <span class="ui-muted ui-num">{serverTime(n.start)}</span>
            </div>
          )}
        </For>
        <Line name="Alert before" about="Minutes before an event begins.">
          <Slide name="Alert before" least={0} most={30} step={1} value={settings.events.before} text={settings.events.before ? `${settings.events.before} min` : "As it opens"} set={(v) => change((s) => (s.events.before = v))} />
        </Line>
      </section>

      <section class="block">
        <h2>Stopwatch and countdown</h2>
        <p class="ui-muted ui-small">Both show on the Time bar. A key for the stopwatch can be set in Settings.</p>
        <div class="ui-row">
          <button class="ui-button" data-main onClick={() => change((s) => (s.clock = toggle(s.clock, Date.now())))}>{!c().start ? "Start" : c().stopped ? "Go on" : "Stop"}</button>
          <button class="ui-button" disabled={!c().start} onClick={() => change((s) => (s.clock = { ...s.clock, start: 0, stopped: 0 }))}>Clear</button>
        </div>
        <div class="ui-row">
          <For each={[5, 10, 15, 30, 60]}>{(m) => <button class="ui-chip" onClick={() => change((s) => (s.clock.end = Date.now() + m * 60_000))}>{m} min</button>}</For>
          <button class="ui-chip" disabled={c().end <= now()} onClick={() => change((s) => (s.clock.end = 0))}>No countdown</button>
        </div>
      </section>

      <section class="block">
        <h2>Odds</h2>
        <p class="ui-muted ui-small">How many tries a chance takes, as for enchanting. The game does not say its odds: type what you know.</p>
        <Line name="Chance a try">
          <Slide name="Chance a try" least={1} most={100} step={1} value={chance()} text={`${chance()}%`} set={setChance} />
        </Line>
        <Line name="Kinah a try">
          <input class="ui-input ui-num" type="number" min="0" max="1000000000" aria-label="Kinah a try" value={cost()} onChange={(e) => setCost(Math.max(0, Number(e.currentTarget.value) || 0))} />
        </Line>
        <Show when={tries()}>
          {(t) => (
            <div class="stats">
              <For each={[["On average", t().mean], ["Half of players, at most", t().half], ["Nine in ten, at most", t().most]] as const}>
                {([name, n]) => (
                  <div class="stat">
                    <small>{name}</small>
                    <b class="ui-num">{Math.ceil(n)} {Math.ceil(n) === 1 ? "try" : "tries"}</b>
                    <Show when={cost()}><small class="ui-num">{full(Math.ceil(n * cost()))} Kinah</small></Show>
                  </div>
                )}
              </For>
            </div>
          )}
        </Show>
      </section>
    </div>
  );
}
