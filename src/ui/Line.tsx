import { For, Show, type JSX } from "solid-js";

/** A setting: its name and a word about it, with its control at the end. */
export function Line(props: { name: string; about?: string; bad?: boolean; children: JSX.Element }) {
  return (
    <div class="line">
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
