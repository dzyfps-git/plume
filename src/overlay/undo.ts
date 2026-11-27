import { createSignal } from "solid-js";
import { unwrap } from "solid-js/store";
import { change, settings } from "../store";
import type { Place } from "../store/settings";

type Places = Record<string, Place>;
const MOST = 60;

const [past, setPast] = createSignal<readonly Places[]>([]);
const [ahead, setAhead] = createSignal<readonly Places[]>([]);
export const canUndo = () => past().length > 0;
export const canRedo = () => ahead().length > 0;

const now = (): Places => structuredClone(unwrap(settings.places));
const show = (places: Places) => change((s) => (s.places = places), true);

/** Changes where overlays are, so that it can be taken back. Unrecorded, it is a preview: `remember` the start once it ends. */
export function move(edit: (places: Places) => Places, record = true) {
  if (record) remember(now());
  show(edit(now()));
}

/** Where overlays were before a change, to take it back to. */
export const snapshot = now;
export function remember(before: Places) {
  setPast((all) => [...all, before].slice(-MOST));
  setAhead([]);
}

export function undo() {
  const before = past().at(-1);
  if (!before) return;
  setPast((all) => all.slice(0, -1));
  setAhead((all) => [...all, now()]);
  show(before);
}

export function redo() {
  const next = ahead().at(-1);
  if (!next) return;
  setAhead((all) => all.slice(0, -1));
  setPast((all) => [...all, now()]);
  show(next);
}
