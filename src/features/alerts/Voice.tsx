import { createSignal, For, onCleanup, Show } from "solid-js";
import { change, settings } from "../../store";
import { Group } from "../../ui/Group";
import { Line, Slide } from "../../ui/Line";
import { Switch } from "../../ui/Switch";
import { speak, voices } from "../timers/voice";

/** The voice that says marks, timers, alerts and auras. */
export function Voice() {
  // Windows gives its voices a moment after they are first asked for.
  const [names, setNames] = createSignal(voices().map((v) => v.name));
  const refresh = () => setNames(voices().map((v) => v.name));
  speechSynthesis.addEventListener("voiceschanged", refresh);
  onCleanup(() => speechSynthesis.removeEventListener("voiceschanged", refresh));
  return (
    <Group name="Voice and volume">
      <Switch name="Say marks, timers and the enrage" about="With a voice of Windows, on this PC. The overlays have to be on." on={settings.voice.on} set={(v) => change((s) => (s.voice.on = v))} />
      <Line name="Voice" about={names().length ? undefined : "Windows has no voice installed."} bad>
        <span class="ui-row">
          <select class="ui-select" aria-label="Voice" value={settings.voice.name} onChange={(e) => change((s) => (s.voice.name = e.currentTarget.value))}>
            <option value="">Windows' own</option>
            <For each={names()}>{(name) => <option value={name}>{name}</option>}</For>
          </select>
          <button class="ui-button" onClick={() => speak("Fifty percent")}>Try it</button>
        </span>
      </Line>
      <Line name="Volume" about="Of the voice and of every sound.">
        <Slide name="Volume" least={0} most={1} step={0.05} value={settings.voice.volume} text={`${Math.round(settings.voice.volume * 100)}%`} set={(v) => change((s) => (s.voice.volume = v))} />
      </Line>
      <Show when={settings.voice.on || Object.keys(settings.bosses).length}>
        <Line name="Ahead of a timer">
          <Slide name="Seconds ahead" least={2} most={15} step={1} value={settings.voice.lead} text={`${settings.voice.lead} s`} set={(v) => change((s) => (s.voice.lead = v))} />
        </Line>
      </Show>
    </Group>
  );
}
