import { Match, Switch } from "solid-js";
import { openEngineFolder } from "../api";
import { GAME } from "../app/brand";
import { engine, live, state } from "../live/store";
import { change } from "../store";

/** Says in plain words why there is nothing to show yet. */
export function Waiting(props: { idle: string }) {
  return (
    <div class="ui-empty">
      <Switch fallback={<Said icon={""} text="Starting the engine." />}>
        <Match when={engine().status === "off"}>
          <Said icon={""} text="Live data is off. History and settings still work." />
          <button class="ui-button" data-main onClick={() => change((s) => (s.live = true))}>Turn on live data</button>
        </Match>
        <Match when={engine().status === "missing"}>
          <Said icon={""} text="The engine is not installed. Put plume-engine.exe in its folder." />
          <button class="ui-button" data-main onClick={() => void openEngineFolder()}>Open the folder</button>
        </Match>
        <Match when={engine().status === "failed"}>
          <Said icon={""} text={engine().message ?? "The engine stopped."} />
        </Match>
        <Match when={live() && state()?.late}>
          <Said icon={""} text={`${props.idle} The engine started after you entered the world, so some names come after the next zone change.`} />
        </Match>
        <Match when={live()}>
          <Said icon={""} text={props.idle} />
        </Match>
        <Match when={engine().status === "running"}>
          <Said icon={""} text={`Waiting for ${GAME}.`} />
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
