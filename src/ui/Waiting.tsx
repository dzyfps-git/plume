import { For, Match, Show, Switch } from "solid-js";
import { openEngineFolder } from "../api";
import { GAME } from "../app/brand";
import { lights } from "../live/health";
import { engine, live, state } from "../live/store";
import { change } from "../store";

/** Says in plain words why there is nothing to show yet, and what is still missing. */
export function Waiting(props: { idle: string }) {
  return (
    <div class="ui-empty">
      <Switch>
        <Match when={engine().status === "off"}>
          <Said icon={""} text="Live data is off. History and settings still work." />
          <button class="ui-button" data-main onClick={() => change((s) => (s.live = true))}>Turn on live data</button>
        </Match>
        <Match when={live() && state()?.late}>
          <Said icon={""} text={`${props.idle} The engine started after you entered the world, so some names come after the next zone change.`} />
        </Match>
        <Match when={live()}>
          <Said icon={""} text={props.idle} />
        </Match>
        <Match when={true}>
          <Said icon={""} text="Once all three are green, your fights show here." />
          <ul class="lights" aria-label="What is ready">
            <For each={lights(engine(), state(), GAME)}>{(l) => <li data-light={l.light}>{l.name}<small>{l.about}</small></li>}</For>
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
