import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { editOverlays, type Editing } from "../api";
import { FEATURES } from "../features";
import { overlayName, type Feature } from "../features/types";
import { demoFight, demoNear } from "../live/demo";
import { fight, near, sample, sampling } from "../live/store";
import { settings } from "../store";
import { place, rule } from "../store/settings";
import { Frame } from "./Frame";
import { Panel } from "./Panel";
import { allowed } from "./rules";
import { canRedo, canUndo, move, redo, undo } from "./undo";
import { followZones } from "./zones";

const FIXED = FEATURES.filter((f) => f.overlay);

/** Idle this long, overlays fade. */
const IDLE = 60_000;
const DRIFT_EVERY = 180_000;
const DRIFT = [[0, 0], [2, 0], [2, 2], [0, 2], [-2, 0], [-2, -2], [0, -2]] as const;

/** Every overlay, on one clear page over the game. */
export function Overlay(props: { editing: () => Editing }) {
  const moving = () => props.editing() === "move";
  let root!: HTMLDivElement;
  const all = createMemo(() => [...FIXED, ...FEATURES.flatMap((f) => f.more?.() ?? [])]);
  const at = (f: Feature) => place(settings.places[f.id], f.overlay!.place);
  const shown = () =>
    all().filter((f) => at(f).on && (moving() || (allowed(rule(settings.rules[f.id]), near) && !(settings.overlay.hideEmpty && f.overlay!.empty?.()))));
  const hidden = () => all().filter((f) => !at(f).on);
  const turn = (f: Feature, on: boolean) => move((all) => ({ ...all, [f.id]: { ...at(f), on } }));
  const boxes = () =>
    [...root.querySelectorAll<HTMLElement>("[data-frame]")].map((el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    });

  for (const f of FEATURES) f.overlay?.beside?.();

  followZones();

  // Made-up things to place overlays by. A fight that goes on stays the real one.
  createEffect(() => {
    if (!moving()) return;
    const begun = performance.now() - 30_000;
    const real = untrack(() => !sampling() && fight.rows.length > 0);
    const step = () => {
      const ms = performance.now() - begun;
      sample({ near: demoNear(ms, Date.now()), ...(!real && { fight: demoFight(ms) }) });
    };
    step();
    const timer = setInterval(step, settings.updateMs);
    onCleanup(() => {
      clearInterval(timer);
      sample();
    });
  });

  // On a screen that can burn in: paler while nothing happens, and never quite in the same place.
  const [idle, setIdle] = createSignal(false);
  createEffect(() => {
    setIdle(false);
    if (!settings.oled || near.fighting || props.editing()) return;
    const timer = setTimeout(() => setIdle(true), IDLE);
    onCleanup(() => clearTimeout(timer));
  });
  const [step, setStep] = createSignal(0);
  const drift = setInterval(() => setStep((n) => (n + 1) % DRIFT.length), DRIFT_EVERY);
  onCleanup(() => clearInterval(drift));
  const shift = () => (settings.oled && !props.editing() ? DRIFT[step()] : DRIFT[0]);

  const done = () => void editOverlays("");
  const keys = (e: KeyboardEvent) => {
    if (!props.editing()) return;
    if (e.key === "Escape") done();
    else if (e.ctrlKey && e.key.toLowerCase() === "z") (e.shiftKey ? redo : undo)();
    else if (e.ctrlKey && e.key.toLowerCase() === "y") redo();
    else return;
    e.preventDefault();
  };
  addEventListener("keydown", keys);
  onCleanup(() => removeEventListener("keydown", keys));

  return (
    <div ref={root} class="screen" data-editing={props.editing() || undefined} data-idle={idle() || undefined} style={{ translate: `${shift()[0]}px ${shift()[1]}px` }}>
      <For each={shown()}>{(f) => <Frame feature={f} editing={moving()} others={boxes} />}</For>
      <Show when={props.editing() === "quick"}>
        <Panel all={all()} on={(f) => at(f).on} turn={turn} done={done} />
      </Show>
      <Show when={moving()}>
        <div class="edit-bar ui-bar">
          <small>
            Drag to move. Scroll to scale. Alt drags freely. What they show is a sample.
          </small>
          <button class="ui-icon-button" aria-label="Undo" aria-keyshortcuts="Control+Z" disabled={!canUndo()} onClick={undo}>{"\ue7a7"}</button>
          <button class="ui-icon-button" aria-label="Redo" aria-keyshortcuts="Control+Y" disabled={!canRedo()} onClick={redo}>{"\ue7a6"}</button>
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
