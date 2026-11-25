import { createResource, For, Show } from "solid-js";
import { soundFiles } from "../../api";
import type { Signal } from "../../store/settings";
import { Line } from "../../ui/Line";
import { Switch } from "../../ui/Switch";
import { signal } from "./signal";
import { BUILT_IN, FILE } from "./sound";

const [own, { refetch }] = createResource(() => soundFiles().catch(() => []));
/** Reads the names of your own sounds again. */
export const refresh = () => void refetch();

/** How something gets your attention: a sound, and said out loud. */
export function SignalLines(props: { of: Signal; words: string; set: (to: Partial<Signal>) => void }) {
  return (
    <>
      <Line name="Sound">
        <span class="ui-row">
          <select class="ui-select" aria-label="Sound" value={props.of.sound} onChange={(e) => props.set({ sound: e.currentTarget.value })}>
            <option value="">None</option>
            <For each={BUILT_IN}>{([id, name]) => <option value={id}>{name}</option>}</For>
            <For each={own() ?? []}>{(name) => <option value={FILE + name} selected={props.of.sound === FILE + name}>{name}</option>}</For>
          </select>
          <button class="ui-button" onClick={() => signal(props.of, props.words)}>Try it</button>
        </span>
      </Line>
      <Show when={props.words}>
        <Switch name="Say it" on={props.of.say} set={(say) => props.set({ say })} />
      </Show>
    </>
  );
}
