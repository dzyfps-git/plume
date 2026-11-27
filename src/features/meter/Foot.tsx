import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { entries, fight, live, near } from "../../live/store";
import { NO_FIGHT } from "../../live/types";
import { settings } from "../../store";
import type { Footer } from "../../store/settings";
import { Drawn, PingBars, Thing, type ThingName } from "../../ui/icons";
import { followFights, runMs } from "../history/store";
import { coming, kindOf, strip } from "../resources/logic";
import { minutes } from "../resources/Overlay";
import { seen } from "../resources/watch";
import { footer, type Foot } from "./logic";

const POP = 1_400;

/** What changed of a figure, for a moment: blue as one comes, pale as one goes. */
export function Pop(props: { n?: number }) {
  const [by, setBy] = createSignal<{ n: number }>();
  let timer = 0;
  createEffect(on(() => props.n, (now, before) => {
    if (now === undefined || before === undefined || now === before || !settings.odyle.pop) return;
    setBy({ n: now - before });
    clearTimeout(timer);
    timer = window.setTimeout(() => setBy(undefined), POP);
  }));
  onCleanup(() => clearTimeout(timer));
  return <Show when={by()} keyed>{(b) => <em class="pop ui-num" data-up={b.n > 0 || undefined}>{b.n > 0 ? "+" : "-"}{Math.abs(b.n)}</em>}</Show>;
}

/** A picture with a ring that fills until more of it comes. */
export function Ringed(props: { id: string; of: ThingName; n: number; now: number }) {
  const next = () => {
    const kind = props.id === "odyle" ? "odyle" : kindOf(Number(props.id), settings.resources);
    return settings.odyle.ring && kind ? coming(kind, props.n, settings.odyle.member, seen()[props.id], props.now) : undefined;
  };
  return (
    <span class="ringed" data-ring={next() ? "" : undefined} style={{ "--part": next()?.part ?? 0 }}>
      <Thing of={props.of} />
    </span>
  );
}

/** `cleared`: the fight is over and its numbers go, so nothing of it is said. */
const items = (which: readonly Footer[], cleared = false) =>
  footer(which, near, cleared ? NO_FIGHT : fight, entries(), strip(entries(), near.odyle, settings.resources, settings.odyleRun), { odyle: settings.odyle, odyleRun: settings.odyleRun, pingAs: settings.pingAs, runMs: runMs() }).filter((f) => f.tone !== "muted" || live());

/** Figures you chose. Odyle Energy and entries can stand elsewhere. */
export function Feet(props: { of: readonly Footer[]; class: string; cleared?: boolean }) {
  followFights();
  const now = minutes();
  const all = () => items(props.of, props.cleared);
  return (
    <Show when={all().length}>
      <div class={`${props.class} ui-num`}>
        {/* By name: a figure that changed stays where it is, and pops. */}
        <For each={all().map((f) => f.key)}>{(key) => <Show when={all().find((f) => f.key === key)}>{(f) => <FootItem of={f()} now={now()} />}</Show>}</For>
      </div>
    </Show>
  );
}

const FootItem = (props: { of: Foot; now: number }) => (
  <span class="foot-item" aria-label={props.of.name} data-tone={props.of.tone}>
    <Show when={props.of.icon === "ping"}><PingBars ping={near.ping} /></Show>
    <Show when={props.of.icon === "flight"}><Drawn name="wing" /></Show>
    <Show when={props.of.thing}>{(thing) => <Ringed id={props.of.key} of={thing()} n={props.of.n ?? -1} now={props.now} />}</Show>
    <Show when={props.of.tag}>{(tag) => <small class="foot-tag">{tag()}</small>}</Show>
    <Show when={!props.of.icon && !props.of.thing}><small>{props.of.name}</small></Show>
    <Show when={props.of.value}><b>{props.of.value}</b></Show>
    <Show when={props.of.bonus}><span class="bonus">{props.of.bonus}</span></Show>
    <Show when={props.of.more}><small>{props.of.more}</small></Show>
    <Pop n={props.of.n} />
  </span>
);
