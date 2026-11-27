import { createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { appWindow } from "../api";
import { NAME } from "../app/brand";
import { MeterOverlay } from "../features/meter/Overlay";
import { widthOf } from "../features/types";
import { live } from "../live/store";
import { change, settings } from "../store";
import { SECOND, type Second } from "../store/settings";
import { Chips, Slide } from "../ui/Line";
import { Curve } from "./Curve";
import { featureOf, SECOND_NAMES } from "./parts";

const set = (edit: (s: Second) => void) => change((s) => edit(s.second), true);

/** The parts you chose, as large as you like, on a screen of their own. */
export function SecondScreen() {
  const [choosing, setChoosing] = createSignal(false);
  return (
    <div class="second">
      <header class="ui-titlebar" data-tauri-drag-region>
        <span class="ui-logo" data-tauri-drag-region>{NAME}</span>
        <span class="status" data-state={live() ? "live" : "off"} role="status" data-tauri-drag-region>{live() ? "Connected" : "Waiting for the game"}</span>
        <button class="ui-button" aria-expanded={choosing()} onClick={() => setChoosing(!choosing())}>Choose</button>
        <button class="ui-icon-button caption" aria-label="Minimize" onClick={() => void appWindow().minimize()}>{"\ue921"}</button>
        <button class="ui-icon-button caption" aria-label="Maximize" onClick={() => void appWindow().toggleMaximize()}>{"\ue922"}</button>
        <button class="ui-icon-button caption" aria-label="Close" onClick={() => void appWindow().close()}>{"\ue8bb"}</button>
      </header>
      <Show when={choosing()}>
        <div class="second-choose">
          <Chips name="What is here" all={SECOND} names={SECOND_NAMES} value={settings.second.parts} set={(parts) => set((s) => (s.parts = parts))} />
          <Slide name="Size" least={0.7} most={2} step={0.05} value={settings.second.size} text={`${Math.round(settings.second.size * 100)}%`} set={(size) => set((s) => (s.size = size))} />
        </div>
      </Show>
      <main class="second-grid" style={{ "--size": settings.second.size }}>
        <For each={settings.second.parts} fallback={<p class="ui-muted">Nothing is chosen.</p>}>{(part) => <Card part={part} />}</For>
      </main>
    </div>
  );
}

function Card(props: { part: Second["parts"][number] }) {
  const overlay = featureOf(props.part)?.overlay;
  const empty = () => overlay?.empty?.() ?? false;
  // The meter is whole here, however it is over the game.
  const view = () => (props.part === "curve" ? Curve : props.part === "meter" ? Meter : overlay!.view);
  return (
    <section class="second-card" data-empty={empty() || undefined} style={{ "--wide": overlay ? `${Math.max(280, widthOf(overlay))}px` : "420px" }}>
      <h2>{SECOND_NAMES[props.part]}</h2>
      <Show when={!empty() || props.part === "meter"} fallback={<p class="ui-muted ui-small">Nothing right now.</p>}>
        <div class="second-body"><Dynamic component={view()} /></div>
      </Show>
    </section>
  );
}

const Meter = () => <MeterOverlay look={{ small: false, compact: false, locked: true, rows: 24 }} />;
