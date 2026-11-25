import { createMemo, For } from "solid-js";
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
  return (
    <section class="strip glass" aria-label="Cooldowns, about">
      <div class="tiles">
        <For each={list()} fallback={<Tile of={{ id: 0, name: "Action Bars", bad: false, stacks: 0, start: 0, end: 0 }} now={0} />}>
          {(k) => {
            const on = () => cooling(k, casts().get(k.skill), now());
            return <Tile of={{ id: k.skill, name: k.name, bad: false, stacks: 0, start: on()?.start ?? 0, end: on()?.end ?? 0, glow: !on() }} now={now()} />;
          }}
        </For>
      </div>
    </section>
  );
}
