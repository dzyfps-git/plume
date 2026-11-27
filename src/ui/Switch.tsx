import { Show, type JSX } from "solid-js";
import { useMissed } from "./search";

/** A setting that is on or off. `pic`: a picture before its name, such as the game's for an effect. */
export function Switch(props: { name: string; about?: string; pic?: JSX.Element; on: boolean; set: (on: boolean) => void }) {
  const missed = useMissed(() => `${props.name} ${props.about ?? ""}`);
  return (
    <button class="ui-switch-row" data-miss={missed()} role="switch" aria-checked={props.on} onClick={() => props.set(!props.on)}>
      <span class="ui-switch-text" data-pic={props.pic ? "" : undefined}>
        {props.pic}
        {props.name}
        <Show when={props.about}>
          <small>{props.about}</small>
        </Show>
      </span>
      <span class="ui-switch" />
    </button>
  );
}
