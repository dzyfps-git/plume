import { For, Match, Show, Switch } from "solid-js";
import { openEngineFolder } from "../api";
import { GAME } from "../app/brand";
import { lights } from "../live/health";
import { engine, live, near, state, WAIT_FOR_YOU, waitingForYou } from "../live/store";
import { change } from "../store";

/** Says in plain words why there is nothing to show yet, and what is still missing. */
export function Waiting(props: { idle: string }) {
  return (
    <div class="ui-empty">
      <Switch>
        <Match when={engine().status === "off"}>
          <Said icon={"\ue7e8"} text="Live data is off. History and settings still work." />
          <button class="ui-button" data-main onClick={() => change((s) => (s.live = true))}>Turn on live data</button>
        </Match>
        <Match when={waitingForYou()}>
          <Said icon={"\ue77b"} text={`Waiting for your character. ${WAIT_FOR_YOU}`} />
        </Match>
        <Match when={live() && state()?.lossy}>
          <Said icon={""} text={`${props.idle} Some of the game's data was lost on the way in the last minute, so a boss or a hit may be missing. A wired connection helps.`} />
        </Match>
        <Match when={live() && state()?.late}>
          <Said icon={"\ue946"} text={`${props.idle} The engine started after you entered the world, so some names come after the next zone change.`} />
        </Match>
        <Match when={live()}>
          <Said icon={"\ue8d7"} text={props.idle} />
        </Match>
        <Match when={true}>
          <Said icon={"\ue7fc"} text="Once all three are green, your fights show here." />
          <ul class="lights" aria-label="What is ready">
            <For each={lights(engine(), state(), GAME, !!near.you?.name)}>{(l) => <li data-light={l.light}>{l.name}<small>{l.about}</small></li>}</For>
          </ul>
          <Show when={engine().status === "missing"}>
            <button class="ui-button" data-main onClick={() => void openEngineFolder()}>Open the folder</button>
          </Show>
        </Match>
      </Switch>
    </div>
  );
}

function Said(props: { icon: string; text: string }) {
  return (
    <>
      <span class="ui-icon" aria-hidden="true">{props.icon}</span>
      <p>{props.text}</p>
    </>
  );
}
