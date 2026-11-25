import { createEffect, createMemo, createRoot, For, onCleanup, Show, untrack } from "solid-js";
import { near } from "../../live/store";
import { settings } from "../../store";
import { ticking } from "../../ui/now";
import { casts, followActions, skills } from "../actions/store";
import { signal } from "../alerts/signal";
import { left, remaining } from "../effects/logic";
import { Tile } from "../effects/Tile";
import { fresh, states, type State } from "./logic";
import "./auras.css";

const NONE: State[] = [];
let list: () => State[] = () => NONE;
export const shown = () => list();

/** Works out which auras show, and sounds them as they come on. */
export function followAuras() {
  followActions();
  createRoot(() => {
    const now = ticking();
    list = createMemo(() => (settings.auras.length ? states(settings.auras, near, skills(), casts(), now()) : NONE));
    let before = new Set<string>();
    createEffect(() => {
      const all = list();
      untrack(() => {
        for (const s of fresh(before, all)) signal(s.rule, s.name);
        before = new Set(all.map((s) => s.rule.key));
      });
    });
  });
}

export function AurasOverlay() {
  const now = ticking();
  // The list is made anew as time passes. Its auras stay in the page by their key.
  const keys = createMemo(() => shown().map((s) => s.rule.key), [], { equals: (a, b) => a.join() === b.join() });
  const of = (key: string) => shown().find((s) => s.rule.key === key);
  const look = (kind: State["rule"]["look"]) => keys().filter((k) => of(k)?.rule.look === kind);
  return (
    <section class="auras" aria-label="Auras">
      <div class="tiles">
        <For each={look("icon")}>
          {(key) => (
            <Show when={of(key)}>
              {(s) => (
                <Tile of={{ id: s().rule.of.id, isSkill: s().rule.kind === "ready", name: s().name, bad: s().rule.kind === "low", stacks: s().stacks, start: s().start, end: s().end, glow: s().rule.glow || s().text === "missing" }} now={now()} />
              )}
            </Show>
          )}
        </For>
      </div>
      <For each={look("bar")}>
        {(key) => (
          <Show when={of(key)}>
            {(s) => (
              <div class="aura-bar glass" data-glow={s().rule.glow || undefined} style={{ "--length": s().end ? (left(s(), now())! / Math.max(1, s().end - s().start)) : 1 }}>
                <i />
                <span>{s().name}</span>
                <b class="ui-num">{s().end ? remaining(left(s(), now())!) : s().text}</b>
              </div>
            )}
          </Show>
        )}
      </For>
      <For each={look("text")}>
        {(key) => (
          <Show when={of(key)}>
            {(s) => <strong class="aura-text ui-num" data-glow={s().rule.glow || undefined}>{s().name} {s().end ? remaining(left(s(), now())!) : s().text}</strong>}
          </Show>
        )}
      </For>
      <Show when={!keys().length}><span class="aura-bar glass"><span>Auras</span></span></Show>
    </section>
  );
}
