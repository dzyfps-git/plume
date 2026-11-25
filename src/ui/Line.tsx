import { For, Show, type JSX } from "solid-js";
import { useMissed } from "./search";

/** A setting: its name and a word about it, with its control at the end, or under it when that is wide. */
export function Line(props: { name: string; about?: string; bad?: boolean; wide?: boolean; children: JSX.Element }) {
  const missed = useMissed(() => `${props.name} ${props.about ?? ""}`);
  return (
    <div class="line" data-wide={props.wide || undefined} data-miss={missed()}>
      <span class="ui-switch-text">
        {props.name}
        <Show when={props.about}>
          <small class={props.bad ? "ui-error" : undefined}>{props.about}</small>
        </Show>
      </span>
      {props.children}
    </div>
  );
}

export function Choices<T>(props: { name: string; all: readonly (readonly [T, JSX.Element])[]; value: T; set: (value: T, from: Element) => void }) {
  return (
    <div class="ui-row" role="radiogroup" aria-label={props.name}>
      <For each={props.all}>
        {([value, name]) => (
          <button class="ui-chip" role="radio" aria-checked={props.value === value} onClick={(e) => props.set(value, e.currentTarget)}>
            {name}
          </button>
        )}
      </For>
    </div>
  );
}

export function Slide(props: { name: string; least: number; most: number; step: number; value: number; text: string; set: (value: number) => void }) {
  return (
    <span class="slide">
      <input
        class="ui-slider"
        type="range"
        aria-label={props.name}
        min={props.least}
        max={props.most}
        step={props.step}
        value={props.value}
        style={{ "--fill": (props.value - props.least) / (props.most - props.least) }}
        onInput={(e) => props.set(e.currentTarget.valueAsNumber)}
      />
      <span class="ui-num">{props.text}</span>
    </span>
  );
}

/** Any number of them, each on or off, in the order they stand in. */
export function Chips<T extends string>(props: { name: string; all: readonly T[]; names: Record<T, string>; value: readonly T[]; set: (value: T[]) => void }) {
  return (
    <div class="ui-row" role="group" aria-label={props.name}>
      <For each={props.all}>
        {(one) => (
          <button class="ui-chip" aria-pressed={props.value.includes(one)} onClick={() => props.set(props.all.filter((x) => props.value.includes(x) !== (x === one)))}>
            {props.names[one]}
          </button>
        )}
      </For>
    </div>
  );
}

/** A colour of your own, or the one it has anyway. */
export function Colour(props: { name: string; value: string; own: string; set: (value: string) => void }) {
  return (
    <span class="ui-row">
      <Show when={props.value}><button class="ui-button" aria-label={`${props.name}, as it was`} onClick={() => props.set("")}>Reset</button></Show>
      <label class="colour" style={{ background: props.value || props.own }}>
        <input type="color" aria-label={props.name} value={props.value || "#808080"} onInput={(e) => props.set(e.currentTarget.value)} />
      </label>
    </span>
  );
}
