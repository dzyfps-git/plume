import { For, Show } from "solid-js";
import type { Aura } from "../../live/types";
import { called, hue, initials, left, remaining } from "./logic";
import { pictureOf } from "../../ui/Pic";
import { Sharp } from "../../ui/Sharp";
import "../meter/meter.css";
import "./effects.css";

type Tiled = Pick<Aura, "id" | "name" | "bad" | "stacks" | "start" | "end"> & { glow?: boolean; skill?: number; /** Its number is a skill's. */ isSkill?: boolean };

/** One effect as its picture or its letters, darkening as it runs out. */
export function Tile(props: { of: Tiled; now: number; small?: boolean }) {
  const name = () => called(props.of);
  const picture = () => pictureOf(props.of.isSkill ? { skill: props.of.id } : { effect: props.of.id, skill: props.of.skill });
  const ms = () => left(props.of, props.now);
  const gone = () => (props.of.end ? Math.min(1, Math.max(0, 1 - ms()! / Math.max(1, props.of.end - props.of.start))) : 0);
  return (
    <span
      class="tile"
      role="img"
      aria-label={name()}
      data-small={props.small || undefined}
      data-bad={props.of.bad || undefined}
      data-glow={props.of.glow || undefined}
      data-ending={(ms() ?? 1e9) < 4_000 || undefined}
      style={{ "--hue": hue(name()), "--gone": `${Math.round(gone() * 100)}%` }}
    >
      <Show when={picture()} fallback={<b>{initials(name())}</b>}>{(bytes) => <Sharp of={bytes()} />}</Show>
      <Show when={props.of.stacks > 1}><small>{props.of.stacks}</small></Show>
      <Show when={ms()}>{(t) => <em class="ui-num">{remaining(t())}</em>}</Show>
    </span>
  );
}

export function Tiles(props: { of: readonly Tiled[]; now: number; most?: number; small?: boolean }) {
  return (
    <div class="tiles">
      <For each={props.of.slice(0, props.most ?? 12)}>{(a) => <Tile of={a} now={props.now} small={props.small} />}</For>
    </div>
  );
}
