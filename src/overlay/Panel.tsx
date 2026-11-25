import { For } from "solid-js";
import { editOverlays } from "../api";
import { overlayName, type Feature } from "../features/types";
import { change, settings } from "../store";
import { Slide } from "../ui/Line";
import { Switch } from "../ui/Switch";
import { canRedo, canUndo, move, redo, undo } from "./undo";

/** Over the game: which overlays are on, how large, and where. */
export function Panel(props: { all: readonly Feature[]; on: (f: Feature) => boolean; turn: (f: Feature, on: boolean) => void; done: () => void }) {
  const set = (edit: Parameters<typeof change>[0]) => change(edit, true);
  /** Every overlay where it was at first, on or off as it is. */
  const reset = () => move((all) => Object.fromEntries(props.all.filter((f) => all[f.id]).map((f) => [f.id, { ...f.overlay!.place, on: props.on(f) }])));
  return (
    <div class="over-panel" role="dialog" aria-label="Overlays">
      <header>
        <strong>Overlays</strong>
        <button class="ui-icon-button" aria-label="Undo" aria-keyshortcuts="Control+Z" disabled={!canUndo()} onClick={undo}>{"\ue7a7"}</button>
        <button class="ui-icon-button" aria-label="Redo" aria-keyshortcuts="Control+Y" disabled={!canRedo()} onClick={redo}>{"\ue7a6"}</button>
        <button class="ui-icon-button" aria-label="Close" aria-keyshortcuts="Escape" onClick={props.done}>{"\ue8bb"}</button>
      </header>
      <div class="over-chips">
        <For each={props.all}>
          {(f) => (
            <button class="ui-chip" aria-pressed={props.on(f)} onClick={() => props.turn(f, !props.on(f))}>
              <span class="ui-icon" aria-hidden="true">{f.icon}</span>
              {overlayName(f)}
            </button>
          )}
        </For>
      </div>
      <div class="line">
        <span class="ui-switch-text">Size of all</span>
        <Slide name="Size of all" least={0.6} most={1.6} step={0.05} value={settings.overlay.size} text={`${Math.round(settings.overlay.size * 100)}%`} set={(v) => set((s) => (s.overlay.size = v))} />
      </div>
      <Switch name="Snap while moving" on={settings.overlay.snap} set={(on) => set((s) => (s.overlay.snap = on))} />
      <Switch name="Meter locked" about="Clicks go through it to the game." on={settings.meter.locked} set={(on) => set((s) => (s.meter.locked = on))} />
      <Switch name="Names and Combat Power hidden" on={settings.discreet} set={(on) => set((s) => (s.discreet = on))} />
      <footer>
        <button class="ui-button" onClick={reset}>Put all back</button>
        <button class="ui-button" onClick={() => void editOverlays("move")}>Move them</button>
        <button class="ui-button" data-main onClick={props.done}>Done</button>
      </footer>
    </div>
  );
}
