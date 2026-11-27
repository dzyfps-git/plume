import { batch, createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { on, startState } from "../api";
import { settings } from "../store";
import { NO_ENTRIES, NO_FIGHT, NO_NEAR, type Entries, type Fight, type Happened, type LootEvent, type RollEvent, type Near, type Position, type Skins, type Reads, type Skill, type State, type Status } from "./types";
import { limit, worth } from "./worth";

const [engine, setEngine] = createSignal<{ status: Status; message?: string }>({ status: "off" });
const [state, setState] = createSignal<State | null>(null);
const [reads, setReads] = createSignal<Reads | null>(null);
const [fight, setFight] = createStore<Fight>(structuredClone(NO_FIGHT));
const [skills, setSkills] = createSignal<{ id: number; skills: Skill[] }>({ id: 0, skills: [] });
const [near, setNear] = createStore<Near>(structuredClone(NO_NEAR));
const [entries, setEntries] = createSignal<Entries>(NO_ENTRIES);
const [place, setPlace] = createSignal<Position | null>(null);
const skinListeners = new Set<(s: Skins) => void>();
/** When each of your skills is back, as the game last said, and when it said it. */
const [cooldowns, setCooldowns] = createSignal<ReadonlyMap<number, { end: number; at: number }>>(new Map());
const listeners = new Set<(h: Happened) => void>();

/** True when the game is connected. */
export const live = () => engine().status === "running" && !!state()?.live;
/** The game talks, but has not yet said who you are: a zone change or a trip to character select makes it say. */
export const waitingForYou = () => live() && !near.you?.name;
export const WAIT_FOR_YOU = "Change zone, or go to character select and log back in, so Plume can read your game data.";

/** Rows keep their place in the page by player, so a bar moves instead of being drawn again. */
const showFight = (next: Fight) => setFight(reconcile(structuredClone(next), { key: "id" }));
let told: Fight = NO_FIGHT;

/** Nobody has hit the target for a while. */
const [over, setOver] = createSignal(true);
let ending = 0;
/** The id the fight shown was kept as, once it was: it is no rival or record of itself. Empty until then, and once another begins. */
const [shownId, setShownId] = createSignal("");
export { shownId };
function hearFight(next: Fight, force = false) {
  // Engines of protocol 1 before 0.6 say no hit breakdown of yours.
  if (!next.own) next = { ...next, own: [0, 0, 0] };
  if (!force && !worth(next, settings.fights.only)) return;
  const hit = next.total !== told.total || next.target.code !== told.target.code;
  if (next.target.code !== told.target.code || next.total < told.total || !next.rows.length) setShownId("");
  told = next;
  // A real fight is shown even while the overlays are being placed: the sample never takes its place.
  if (!sampling() || next.rows.length) showFight(next);
  if (!hit) return;
  clearTimeout(ending);
  setOver(next.rows.length === 0);
  if (next.rows.length) ending = window.setTimeout(() => setOver(true), limit(next.target, settings.fights));
}
/** An empty meter, until the next hit. */
export const clearFight = () => hearFight(NO_FIGHT, true);

/** Made-up things are shown in place of what is really near. Nothing alerts to them. */
const [sampling, setSampling] = createSignal(false);
let said: Near = NO_NEAR;
/** Effects and players keep their place in the page too. */
const showNear = (next: Near) => setNear(reconcile(structuredClone(next), { key: "key" }));

function hearNear(next: Near) {
  said = next;
  if (!sampling()) showNear(next);
}

/** Shows something made up, or what is really going on again. A made-up fight is shown only while there is no real one. */
export function sample(made?: { near: Near; fight?: Fight }) {
  // At once, or what was made up would pass for real in between.
  batch(() => {
    setSampling(!!made);
    showNear(made?.near ?? said);
    showFight(made?.fight && !told.rows.length ? made.fight : told);
  });
}

export { engine, state, reads, fight, skills, near, entries, place, cooldowns, sampling, over };

export const tell = (h: Happened) => listeners.forEach((hear) => hear(h));
/** Calls `hear` with everything that happens, for as long as the window is open. */
export const onHappened = (hear: (h: Happened) => void) => void listeners.add(hear);
/** Calls `hear` with what the game says of your Closet. */
export const onSkins = (hear: (s: Skins) => void) => void skinListeners.add(hear);
const lootListeners = new Set<(m: { t: "loot"; events: LootEvent[] } | { t: "rolls"; events: RollEvent[] }) => void>();
/** Calls `hear` with loot and Dice Rolls as they come. */
export const onLoot = (hear: (m: { t: "loot"; events: LootEvent[] } | { t: "rolls"; events: RollEvent[] }) => void) => void lootListeners.add(hear);

/** Listens first, then reads where things are: what was heard while reading is newer, and is kept. */
export async function follow() {
  const heard = new Set<string>();
  await on("engine", (value) => {
    heard.add("engine");
    setEngine(value);
    if (value.status === "running") return;
    for (const key of ["state", "reads", "near", "entries", "place"]) heard.add(key);
    setState(null);
    setReads(null);
    hearNear(NO_NEAR);
    setEntries(NO_ENTRIES);
    setPlace(null);
  });
  await on("live", (message) => {
    heard.add(message.t);
    if (message.t === "fight") hearFight(message);
    else if (message.t === "state") setState(message);
    else if (message.t === "skills") setSkills(message);
    else if (message.t === "reads") setReads(message);
    else if (message.t === "near") hearNear(message);
    else if (message.t === "entries") setEntries(message);
    else if (message.t === "happened") tell(message);
    else if (message.t === "place") setPlace(message);
    else if (message.t === "skins") skinListeners.forEach((hear) => hear(message));
    else if (message.t === "loot" || message.t === "rolls") lootListeners.forEach((hear) => hear(message));
    else if (message.t === "cooldowns") setCooldowns((all) => new Map([...all, ...message.list.map(([skill, ms]) => [skill, { end: message.at + ms, at: message.at }] as const)]));
  });
  await on("cleared", clearFight);
  await on("saved", ({ id, code }) => {
    if (id && code === told.target.code && told.rows.length) setShownId(id);
  });
  const start = await startState();
  if (!heard.has("engine")) setEngine(start.engine);
  if (!heard.has("state")) setState(start.state);
  if (!heard.has("reads")) setReads(start.reads);
  if (start.fight && !heard.has("fight")) hearFight(start.fight);
  if (start.near && !heard.has("near")) hearNear(start.near);
  if (start.entries && !heard.has("entries")) setEntries(start.entries);
  if (!heard.has("place")) setPlace(start.place ?? null);
}
