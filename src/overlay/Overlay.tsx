import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { editOverlays } from "../api";
import { FEATURES } from "../features";
import { demoFight } from "../live/demo";
import { fight, live, showFight } from "../live/store";
import { NO_FIGHT } from "../live/types";
import { change, settings } from "../store";
import { place } from "../store/settings";
import { Frame } from "./Frame";

const ALL = FEATURES.filter((f) => f.overlay);

/** Every overlay, on one clear page over the game. */
export function Overlay(props: { editing: () => boolean }) {
  let root!: HTMLDivElement;
  const at = (id: string) => place(settings.places[id], FEATURES.find((f) => f.id === id)!.overlay!.place);
  const shown = () =>
    ALL.filter((f) => at(f.id).on && (props.editing() || !settings.overlay.hideEmpty || !f.overlay!.empty?.()));
  const hidden = () => ALL.filter((f) => !at(f.id).on);
  const boxes = () =>
    [...root.querySelectorAll<HTMLElement>("[data-frame]")].map((el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    });

  // With no fight going on there is a made-up one to place overlays by.
  const [sample, setSample] = createSignal(false);
  createEffect(() => {
    if (props.editing() && !fight.rows.length) setSample(true);
    if (!props.editing() && sample()) {
      setSample(false);
      showFight(structuredClone(NO_FIGHT));
    }
  });
  createEffect(() => {
    if (!sample()) return;
    const begun = performance.now() - 30_000;
    const step = () => showFight(demoFight(performance.now() - begun));
    step();
    const timer = setInterval(step, settings.updateMs);
    onCleanup(() => clearInterval(timer));
  });

  const done = () => void editOverlays(false);
  const keys = (e: KeyboardEvent) => e.key === "Escape" && props.editing() && done();
  addEventListener("keydown", keys);
  onCleanup(() => removeEventListener("keydown", keys));

  return (
    <div ref={root} class="screen" data-editing={props.editing() || undefined}>
      <For each={shown()}>{(f) => <Frame feature={f} editing={props.editing()} others={boxes} />}</For>
      <Show when={props.editing()}>
        <div class="edit-bar ui-bar">
          <small>
            Drag to move. Scroll to scale. Alt drags freely.
            <Show when={sample() && live()}> Sample fight shown.</Show>
          </small>
          <For each={hidden()}>
            {(f) => (
              <button
                class="ui-button"
                onClick={() => change((s) => (s.places = { ...s.places, [f.id]: { ...at(f.id), on: true } }), true)}
              >
                <span class="ui-icon" aria-hidden="true">{""}</span>
                {f.name}
              </button>
            )}
          </For>
          <button class="ui-button" data-main aria-keyshortcuts="Escape" onClick={done}>Done</button>
        </div>
      </Show>
    </div>
  );
}
