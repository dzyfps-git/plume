import { createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { on, type Start } from "../api";
import { NO_FIGHT, type Fight, type Skill, type State, type Status } from "./types";

const [engine, setEngine] = createSignal<{ status: Status; message?: string }>({ status: "off" });
const [state, setState] = createSignal<State | null>(null);
const [fight, setFight] = createStore<Fight>(structuredClone(NO_FIGHT));
const [skills, setSkills] = createSignal<{ id: number; skills: Skill[] }>({ id: 0, skills: [] });

export { engine, state, fight, skills };

/** True when the game is connected. */
export const live = () => engine().status === "running" && !!state()?.live;

/** Rows keep their place in the page by player, so a bar moves instead of being drawn again. */
export const showFight = (next: Fight) => setFight(reconcile(next, { key: "id" }));

export async function follow(start: Start) {
  setEngine(start.engine);
  setState(start.state);
  if (start.fight) showFight(start.fight);
  await on("engine", (value) => {
    setEngine(value);
    if (value.status !== "running") setState(null);
  });
  await on("live", (message) => {
    if (message.t === "fight") showFight(message);
    else if (message.t === "state") setState(message);
    else if (message.t === "skills") setSkills(message);
  });
}
