import { createEffect, createMemo, createRoot, For, Match, Show, Switch, untrack } from "solid-js";
import { near, sampling } from "../../live/store";
import { settings } from "../../store";
import { ticking } from "../../ui/now";
import { casts, followActions, skills } from "../actions/store";
import { signal } from "../alerts/signal";
import { left, remaining } from "../effects/logic";
import { Tile } from "../effects/Tile";
import type { Feature } from "../types";
import { fresh, placeOf, ruleName, states, type State } from "./logic";
import "./auras.css";

const NONE: State[] = [];
let list: () => State[] = () => NONE;
const shown = () => list();
/** Those that stand together in one overlay. */
export const together = () => list().filter((s) => !s.rule.own);

/** Works out which auras show, and sounds them as they come on. */
export function followAuras() {
  followActions();
  createRoot(() => {
    const now = ticking();
    list = createMemo(() => (settings.auras.length ? states(settings.auras, near, skills(), casts(), now()) : NONE));
    let before = new Set<string>();
    createEffect(() => {
      const all = list();
      // A sample to place overlays by sounds nothing, and what was really on before it is what live data is weighed against after.
      if (sampling()) return;
      untrack(() => {
        for (const s of fresh(before, all)) signal(s.rule, s.name);
        before = new Set(all.map((s) => s.rule.key));
      });
    });
  });
}

/** One aura, as it was chosen to look. */
function One(props: { of: State; now: number }) {
  const s = () => props.of;
  const time = () => (s().end ? remaining(left(s(), props.now)!) : s().text);
  return (
    <Switch>
      <Match when={s().rule.look === "icon"}>
        <Tile of={{ id: s().rule.of.id, isSkill: s().rule.kind === "ready", name: s().name, bad: s().rule.kind === "low", stacks: s().stacks, start: s().start, end: s().end, glow: s().rule.glow || s().text === "missing" }} now={props.now} />
      </Match>
      <Match when={s().rule.look === "bar"}>
        <div class="aura-bar glass" data-glow={s().rule.glow || undefined} style={{ "--length": s().end ? left(s(), props.now)! / Math.max(1, s().end - s().start) : 1 }}>
          <i />
          <span>{s().name}</span>
          <b class="ui-num">{time()}</b>
        </div>
      </Match>
      <Match when={s().rule.look === "text"}>
        <strong class="aura-text ui-num" data-glow={s().rule.glow || undefined}>{s().name} {time()}</strong>
      </Match>
    </Switch>
  );
}

export function AurasOverlay() {
  const now = ticking();
  // The list is made anew as time passes. Its auras stay in the page by their key.
  const keys = createMemo(() => together().map((s) => s.rule.key), [], { equals: (a, b) => a.join() === b.join() });
  const of = (key: string) => together().find((s) => s.rule.key === key);
  const look = (kind: State["rule"]["look"]) => keys().filter((k) => of(k)?.rule.look === kind);
  const all = (kind: State["rule"]["look"]) => <For each={look(kind)}>{(key) => <Show when={of(key)}>{(s) => <One of={s()} now={now()} />}</Show>}</For>;
  return (
    <section class="auras" aria-label="Auras">
      <div class="tiles">{all("icon")}</div>
      {all("bar")}
      {all("text")}
      <Show when={!keys().length}><span class="aura-bar glass"><span>Auras</span></span></Show>
    </section>
  );
}

const WIDTHS = { icon: 44, bar: 220, text: 260 } as const;
const made = new Map<string, Feature>();

/** Each aura with a place of its own, as an overlay. */
export const ownAuras = (): Feature[] => settings.auras.filter((a) => a.own && a.on).map(({ key }) => {
  const before = made.get(key);
  if (before) return before;
  const rule = () => settings.auras.find((a) => a.key === key);
  const here = () => shown().find((s) => s.rule.key === key);
  // One below the other at first.
  const n = made.size;
  const feature: Feature = {
    id: placeOf(key),
    get name() { return rule() ? ruleName(rule()!) : "Aura"; },
    icon: "\ue945",
    overlay: {
      view: () => {
        const now = ticking();
        // While it is placed it may have nothing to show, so it shows itself. In play an aura that is not on shows nothing.
        const of = (): State | undefined => here() ?? (sampling() && rule() ? { rule: rule()!, name: ruleName(rule()!), start: 0, end: 0, stacks: 0, text: "" } : undefined);
        return <section class="auras" aria-label="Aura"><Show when={of()}>{(s) => <One of={s()} now={now()} />}</Show></section>;
      },
      group: "Effects",
      about: "",
      get width() { return WIDTHS[rule()?.look ?? "icon"]; },
      place: { on: true, x: 0.3 + (Math.floor(n / 8) % 4) * 0.2, y: 0.28 + (n % 8) * 0.07, scale: 1 },
      empty: () => !here(),
    },
  };
  made.set(key, feature);
  return feature;
});
