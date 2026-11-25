import { For } from "solid-js";
import { editOverlays, engineSend, openPage } from "../../api";
import { change, settings } from "../../store";
import { VIEWS, type Button } from "../../store/settings";
import { VIEW_NAMES } from "./logic";

interface Act {
  name: string;
  icon: () => string;
  run: () => void;
  on?: () => boolean;
}

const set = (edit: Parameters<typeof change>[0]) => change(edit, true);

export const ACTS: Record<Button, Act> = {
  view: { name: "Next view", icon: () => "", run: () => set((s) => (s.meter.view = VIEWS[(VIEWS.indexOf(s.meter.view) + 1) % VIEWS.length])) },
  clear: { name: "Start again", icon: () => "", run: () => void engineSend({ cmd: "reset" }).catch(console.error) },
  history: { name: "History", icon: () => "", run: () => void openPage("history") },
  compact: { name: "One bar", icon: () => (settings.meter.small ? "" : ""), run: () => set((s) => (s.meter.small = !s.meter.small)), on: () => settings.meter.small },
  lock: { name: "Lock", icon: () => (settings.meter.locked ? "" : ""), run: () => set((s) => (s.meter.locked = !s.meter.locked)), on: () => settings.meter.locked },
  sound: { name: "Sound", icon: () => (settings.voice.mute ? "" : ""), run: () => set((s) => (s.voice.mute = !s.voice.mute)), on: () => !settings.voice.mute },
  clock: { name: "Fight clock", icon: () => "", run: () => set((s) => (s.meter.clock = !s.meter.clock)), on: () => settings.meter.clock },
  news: { name: "What is new", icon: () => "", run: () => void openPage("news") },
  menu: { name: "Panel", icon: () => "", run: () => void editOverlays("quick") },
};

/** The buttons you chose for how the meter is now. Locked, only they take the mouse. */
export function Buttons() {
  const list = () => (settings.meter.locked ? settings.meter.buttonsLocked : settings.meter.buttons);
  return (
    <div class="meter-buttons" role="toolbar" aria-label="Meter" data-touch>
      <For each={list()}>
        {(id) => (
          <button class="meter-button" aria-label={id === "view" ? `${ACTS.view.name}, now ${VIEW_NAMES[settings.meter.view]}` : ACTS[id].name} aria-pressed={ACTS[id].on?.()} onClick={() => ACTS[id].run()}>
            {ACTS[id].icon()}
          </button>
        )}
      </For>
    </div>
  );
}
