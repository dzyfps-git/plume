import { Show } from "solid-js";
import { useMissed } from "./search";

export function Switch(props: { name: string; about?: string; on: boolean; set: (on: boolean) => void }) {
  const missed = useMissed(() => `${props.name} ${props.about ?? ""}`);
  return (
    <button class="ui-switch-row" data-miss={missed()} role="switch" aria-checked={props.on} onClick={() => props.set(!props.on)}>
      <span class="ui-switch-text">
        {props.name}
        <Show when={props.about}>
          <small>{props.about}</small>
        </Show>
      </span>
      <span class="ui-switch" />
    </button>
  );
}
