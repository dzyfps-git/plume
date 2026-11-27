import { createSignal, onCleanup } from "solid-js";

/** The time, ten times a second. Runs only while what asked for it is on screen. */
export function ticking() {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 100);
  onCleanup(() => clearInterval(timer));
  return now;
}
