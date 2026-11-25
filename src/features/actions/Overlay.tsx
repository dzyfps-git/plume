import { createMemo, For, Show } from "solid-js";
import { cooldowns } from "../../live/store";
import { settings } from "../../store";
import { ticking } from "../../ui/now";
import { Tile } from "../effects/Tile";
import { cooling } from "./logic";
import { casts, skills } from "./store";

const MOST = 14;

/** Those you use: a skill not cast since the start may not be on your bars any more. */
export const bar = () => skills().filter((k) => !settings.skip.includes(k.skill)).slice(0, MOST);

export function ActionsOverlay() {
  const now = ticking();
  const list = createMemo(bar);
  const set = () => settings.cooldowns;
  return (
    <section class="strip glass" aria-label="Cooldowns" style={{ "--tile": `${set().size}px`, "--dim": set().dim }}>
      <div class="tiles">
        <For each={list()} fallback={<Tile of={{ id: 0, name: "Action Bars", bad: false, stacks: 0, start: 0, end: 0 }} now={0} />}>
          {(k) => {
            const on = () => cooling(k, casts().get(k.skill), now(), cooldowns().get(k.skill));
            return (
              <Show when={on() || set().ready}>
                <Tile of={{ id: k.skill, isSkill: true, name: k.name, bad: false, stacks: 0, start: on()?.start ?? 0, end: on()?.end ?? 0, ready: !on(), cooling: !!on() }} now={now()} />
              </Show>
            );
          }}
        </For>
      </div>
    </section>
  );
}
