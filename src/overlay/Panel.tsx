import { createSignal, For, Show } from "solid-js";
import { openPage } from "../api";
import { OverlaySettings } from "../app/Overlays";
import { GROUPS, overlayName, type Feature } from "../features/types";
import { change, settings } from "../store";
import type { Settings } from "../store/settings";
import { Choices, Slide } from "../ui/Line";
import { Switch } from "../ui/Switch";
import { canRedo, canUndo, move, redo, undo } from "./undo";

const RATES = [50, 100, 250, 500, 1000] as const;

/** The overlay whose settings are open beside the controls: by its gear here, or the gear on the overlay itself. */
const [opened, setOpened] = createSignal("");
export { opened, setOpened };
const AFTER = [0, 5, 10, 20, 30, 60] as const;

/** Over the game, as the overlay controls key or button opens it: which overlays are on, and how all of them behave. Overlays can be dragged meanwhile. */
export function Panel(props: { all: readonly Feature[]; on: (f: Feature) => boolean; turn: (f: Feature, on: boolean) => void; done: () => void }) {
  const set = (edit: Parameters<typeof change>[0]) => change(edit, true);
  const over = <K extends keyof Settings["overlay"]>(key: K) => (value: Settings["overlay"][K]) => set((s) => (s.overlay[key] = value));
  /** Every overlay where it was at first, on or off as it is. */
  const reset = () => move((all) => Object.fromEntries(props.all.filter((f) => all[f.id]).map((f) => [f.id, { ...f.overlay!.place, on: props.on(f) }])));
  return (
    <div class="over-panel" role="dialog" aria-label="Overlay controls">
      <header>
        <span class="ui-icon" aria-hidden="true">{"\ue9e9"}</span>
        <strong>Overlay controls</strong>
        <button class="ui-icon-button" aria-label="Undo" aria-keyshortcuts="Control+Z" disabled={!canUndo()} onClick={undo}>{"\ue7a7"}</button>
        <button class="ui-icon-button" aria-label="Redo" aria-keyshortcuts="Control+Y" disabled={!canRedo()} onClick={redo}>{"\ue7a6"}</button>
        <button class="ui-icon-button" aria-label="Close" aria-keyshortcuts="Escape" onClick={props.done}>{"\ue8bb"}</button>
      </header>
      <small class="over-hint">Drag any overlay to move it. Drag its corner, or scroll on it, to size it. The gear beside one opens its own settings.</small>

      <For each={GROUPS}>
        {(group) => (
          <Show when={props.all.some((f) => f.overlay!.group === group)}>
            <h3>{group}</h3>
            <div class="over-list">
              <For each={props.all.filter((f) => f.overlay!.group === group)}>
                {(f) => (
                  <div class="over-item" data-open={opened() === f.id || undefined}>
                    <button class="over-pick" aria-pressed={props.on(f)} onClick={() => props.turn(f, !props.on(f))}>
                      <span class="ui-icon" aria-hidden="true" style={{ "--icon-color": f.color }}>{f.icon}</span>
                      <span>{overlayName(f)}</span>
                    </button>
                    <button class="ui-icon-button" aria-label={`Settings of ${overlayName(f)}`} aria-expanded={opened() === f.id} onClick={() => setOpened(opened() === f.id ? "" : f.id)}>{""}</button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        )}
      </For>

      <h3>All overlays</h3>
      <div class="line">
        <span class="ui-switch-text">Size</span>
        <Slide name="Size" least={0.6} most={1.6} step={0.05} value={settings.overlay.size} text={`${Math.round(settings.overlay.size * 100)}%`} set={over("size")} />
      </div>
      <div class="line">
        <span class="ui-switch-text">Background</span>
        <Slide name="Background" least={0.2} most={1} step={0.02} value={settings.overlay.opacity} text={`${Math.round(settings.overlay.opacity * 100)}%`} set={over("opacity")} />
      </div>
      <div class="over-line">
        <span>Numbers change every</span>
        <Choices name="Numbers change every" all={RATES.map((n) => [n, n < 1000 ? `${n} ms` : "1 s"] as const)} value={settings.updateMs} set={(n) => set((s) => (s.updateMs = n))} />
        <small class="over-hint">How often the numbers over the game are drawn again. 1000 ms is one second. 250 ms is smooth and light; 50 ms is the most live and uses the most CPU; 1 s is the lightest.</small>
      </div>
      <Switch name="Snap while moving" on={settings.overlay.snap} set={over("snap")} />
      <Switch name="Handles while you play" about="Drag an overlay by its top edge while the mouse pointer shows. Right-click it for its menu." on={settings.overlay.grips} set={over("grips")} />
      <Switch name="Button over the game" about={`Opens these controls. So does ${settings.hotkeys.quick || "a key you set"}.`} on={settings.overlay.button} set={over("button")} />
      <Switch name="Meter locked" about="Clicks go through it to the game." on={settings.meter.locked} set={(on) => set((s) => (s.meter.locked = on))} />
      <Switch name="Names and Combat Power hidden" on={settings.discreet} set={(on) => set((s) => (s.discreet = on))} />

      <h3>Game UI size</h3>
      <small class="over-hint">As set in the game, so that overlays grow and shrink with it.</small>
      <Choices name="Game UI size" all={[1, 2, 3, 4, 5].map((n) => [n, String(n)] as const)} value={settings.overlay.game} set={over("game")} />

      <h3>A fight</h3>
      <div class="over-line">
        <span>Starts with</span>
        <Choices name="A fight starts with" all={[["game", "The game's word"], ["you", "Your hits"], ["party", "The party's hits"]] as const} value={settings.overlay.fightBy} set={over("fightBy")} />
      </div>
      <div class="over-line">
        <span>Overlays stay after it</span>
        <Choices name="Overlays stay after a fight" all={AFTER.map((n) => [n, n ? `${n} s` : "No"] as const)} value={settings.overlay.linger} set={over("linger")} />
      </div>

      <footer>
        <button class="ui-button" onClick={() => (props.done(), void openPage("overlays"))}>
          <span class="ui-icon" aria-hidden="true">{"\ue8a7"}</span>
          Open in the app
        </button>
        <button class="ui-button" onClick={reset}>Put all back</button>
        <button class="ui-button" data-main onClick={props.done}>Done</button>
      </footer>
      <Show when={props.all.find((f) => f.id === opened())}>
        {(f) => (
          <div class="over-panel over-side" role="dialog" aria-label={`Settings of ${overlayName(f())}`}>
            <header>
              <span class="ui-icon" aria-hidden="true" style={{ "--icon-color": f().color }}>{f().icon}</span>
              <strong>{overlayName(f())}</strong>
              <button class="ui-icon-button" aria-label="Close its settings" onClick={() => setOpened("")}>{""}</button>
            </header>
            <OverlaySettings of={f()} over />
          </div>
        )}
      </Show>
    </div>
  );
}
