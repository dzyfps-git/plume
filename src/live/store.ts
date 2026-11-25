import { batch, createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { on, type Start } from "../api";
import { NO_FIGHT, NO_NEAR, type Fight, type Happened, type Near, type Reads, type Skill, type State, type Status } from "./types";

const [engine, setEngine] = createSignal<{ status: Status; message?: string }>({ status: "off" });
const [state, setState] = createSignal<State | null>(null);
const [reads, setReads] = createSignal<Reads | null>(null);
const [fight, setFight] = createStore<Fight>(structuredClone(NO_FIGHT));
const [skills, setSkills] = createSignal<{ id: number; skills: Skill[] }>({ id: 0, skills: [] });
const [near, setNear] = createStore<Near>(structuredClone(NO_NEAR));
const listeners = new Set<(h: Happened) => void>();

/** True when the game is connected. */
export const live = () => engine().status === "running" && !!state()?.live;

/** Rows keep their place in the page by player, so a bar moves instead of being drawn again. */
export const showFight = (next: Fight) => setFight(reconcile(next, { key: "id" }));

/** Made-up things are shown in place of what is really near. Nothing alerts to them. */
const [sampling, setSampling] = createSignal(false);
let said: Near = NO_NEAR;
/** Effects and players keep their place in the page too. */
const showNear = (next: Near) => setNear(reconcile(structuredClone(next), { key: "key" }));

function hearNear(next: Near) {
  said = next;
  if (!sampling()) showNear(next);
}

/** Shows something made up, or what is really near again. */
export function sampleNear(made?: Near) {
  // At once, or what was made up would pass for real in between.
  batch(() => {
    setSampling(!!made);
    showNear(made ?? said);
  });
}

export { engine, state, reads, fight, skills, near, sampling };

export const tell = (h: Happened) => listeners.forEach((hear) => hear(h));
/** Calls `hear` with everything that happens, for as long as the window is open. */
export const onHappened = (hear: (h: Happened) => void) => void listeners.add(hear);

export async function follow(start: Start) {
  setEngine(start.engine);
  setState(start.state);
  setReads(start.reads);
  if (start.fight) showFight(start.fight);
  if (start.near) hearNear(start.near);
  await on("engine", (value) => {
    setEngine(value);
    if (value.status === "running") return;
    setState(null);
    setReads(null);
    hearNear(NO_NEAR);
  });
  await on("live", (message) => {
    if (message.t === "fight") showFight(message);
    else if (message.t === "state") setState(message);
    else if (message.t === "skills") setSkills(message);
    else if (message.t === "reads") setReads(message);
    else if (message.t === "near") hearNear(message);
    else if (message.t === "happened") tell(message);
  });
}
