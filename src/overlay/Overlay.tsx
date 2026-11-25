import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { editOverlays, type Editing } from "../api";
import { FEATURES } from "../features";
import { overlayName, type Feature } from "../features/types";
import { demoFight, demoNear } from "../live/demo";
import { fight, near, sampleNear, showFight } from "../live/store";
import { NO_FIGHT } from "../live/types";
import { change, settings } from "../store";
import { place, rule } from "../store/settings";
import { Frame } from "./Frame";
import { allowed } from "./rules";

const FIXED = FEATURES.filter((f) => f.overlay);

/** Every overlay, on one clear page over the game. */
export function Overlay(props: { editing: () => Editing }) {
  const moving = () => props.editing() === "move";
  let root!: HTMLDivElement;
  const all = createMemo(() => [...FIXED, ...FEATURES.flatMap((f) => f.more?.() ?? [])]);
  const at = (f: Feature) => place(settings.places[f.id], f.overlay!.place);
  const shown = () =>
    all().filter((f) => at(f).on && (moving() || (allowed(rule(settings.rules[f.id]), near) && !(settings.overlay.hideEmpty && f.overlay!.empty?.()))));
  const hidden = () => all().filter((f) => !at(f).on);
  const turn = (f: Feature, on: boolean) => change((s) => (s.places = { ...s.places, [f.id]: { ...at(f), on } }), true);
  const boxes = () =>
    [...root.querySelectorAll<HTMLElement>("[data-frame]")].map((el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    });

  for (const f of FEATURES) f.overlay?.beside?.();

  // With no fight going on there is a made-up one to place overlays by.
  const [sample, setSample] = createSignal(false);
  createEffect(() => {
    if (moving() && !fight.rows.length) setSample(true);
    if (!moving() && sample()) {
      setSample(false);
      showFight(structuredClone(NO_FIGHT));
    }
  });
  createEffect(() => {
    if (!moving()) return;
    const begun = performance.now() - 30_000;
    const step = () => {
      const ms = performance.now() - begun;
      if (sample()) showFight(demoFight(ms));
      sampleNear(demoNear(ms, Date.now()));
    };
    step();
    const timer = setInterval(step, settings.updateMs);
    onCleanup(() => {
      clearInterval(timer);
      sampleNear();
    });
  });

  const done = () => void editOverlays("");
  const keys = (e: KeyboardEvent) => e.key === "Escape" && props.editing() && done();
  addEventListener("keydown", keys);
  onCleanup(() => removeEventListener("keydown", keys));

  return (
    <div ref={root} class="screen" data-editing={props.editing() || undefined}>
      <For each={shown()}>{(f) => <Frame feature={f} editing={moving()} others={boxes} />}</For>
      <Show when={props.editing() === "quick"}>
        <div class="edit-bar quick-bar ui-bar" role="toolbar" aria-label="Overlays">
          <For each={all()}>
            {(f) => (
              <button class="ui-chip" aria-pressed={at(f).on} onClick={() => turn(f, !at(f).on)}>
                <span class="ui-icon" aria-hidden="true">{f.icon}</span>
                {overlayName(f)}
              </button>
            )}
          </For>
          <button class="ui-button" onClick={() => void editOverlays("move")}>Move them</button>
          <button class="ui-button" data-main aria-keyshortcuts="Escape" onClick={done}>Done</button>
        </div>
      </Show>
      <Show when={moving()}>
        <div class="edit-bar ui-bar">
          <small>
            Drag to move. Scroll to scale. Alt drags freely. What they show is a sample.
          </small>
          <For each={hidden()}>
            {(f) => (
              <button class="ui-button" onClick={() => turn(f, true)}>
                <span class="ui-icon" aria-hidden="true">{""}</span>
                {overlayName(f)}
              </button>
            )}
          </For>
          <button class="ui-button" data-main aria-keyshortcuts="Escape" onClick={done}>Done</button>
        </div>
      </Show>
    </div>
  );
}
