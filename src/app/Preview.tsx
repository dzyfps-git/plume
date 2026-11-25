import { onCleanup, onMount, type JSX } from "solid-js";
import { demoFight, demoNear } from "../live/demo";
import { sample } from "../live/store";
import { settings } from "../store";

let users = 0;
let timer = 0;
const begun = performance.now() - 30_000;
const step = () => {
  const ms = performance.now() - begun;
  sample({ near: demoNear(ms, Date.now()), fight: demoFight(ms) });
};

/** A made-up fight in this window, for as long as someone looks at it. */
export function useSample() {
  onMount(() => {
    if (users++) return;
    step();
    timer = window.setInterval(step, settings.updateMs);
  });
  onCleanup(() => {
    if (--users) return;
    clearInterval(timer);
    sample();
  });
}

/** How an overlay looks over the game, with a made-up fight. */
export function Preview(props: { width: number; children: JSX.Element }) {
  useSample();
  return (
    <div class="preview" data-theme="dark" aria-hidden="true" inert>
      <div style={{ width: `${props.width}px` }}>{props.children}</div>
    </div>
  );
}
