import { createMemo, createResource, createSignal, For, Match, Show, Switch } from "solid-js";
import { change, settings } from "../../store";
import type { Layer } from "../../store/settings";
import { KIND_NAMES, toGo, type Pet } from "../pets/logic";
import type { Picked } from "./Canvas";
import { dropFile, petFile, type You } from "./data";
import { byRegion, counted, droppers, far, height, itemsLike, keyOf, LAYER_COLOURS, matches, nearest, pack, spots, tick, type Thing, type WorldMap } from "./logic";

export const TABS = ["pets", "trace", "cube", "gather", "monster", "item", "route"] as const;
type Tab = (typeof TABS)[number];
const TAB_NAMES: Record<Tab, string> = { pets: "Pets", trace: "Traces", cube: "Cubes", gather: "Gathering", monster: "Monsters", item: "Items", route: "Routes" };

export const toggleTrack = (key: string, on?: boolean) =>
  change((s) => {
    const has = s.world.tracked.includes(key);
    if (on ?? !has) s.world.tracked = has ? s.world.tracked : [...s.world.tracked, key];
    else s.world.tracked = s.world.tracked.filter((k) => k !== key);
  });

export const tickFound = (key: string, spot: { x: number; y: number }) => change((s) => (s.world.found = tick(s.world.found, key, spot)));

export interface TrackerProps {
  map: WorldMap;
  you: You | null;
  pick: (p: Picked) => void;
  look: (at: { x: number; y: number; across?: number }) => void;
  /** The route being drawn, and the one shown. */
  drawing: string;
  setDrawing: (key: string) => void;
  route: string;
  setRoute: (key: string) => void;
}

/** Things to follow on the map, by kind. */
export function Tracker(props: TrackerProps) {
  const [tab, setTab] = createSignal<Tab>("trace");
  const here = () => (props.you?.known && props.you.map === props.map.id ? props.you : null);
  const tracked = (layer?: Layer) => settings.world.tracked.filter((k) => k.startsWith(`${props.map.id}/`) && (!layer || props.map.things.some((t) => t.layer === layer && keyOf(props.map.id, t) === k))).length;
  const countOf = (t: Tab) => (t === "pets" ? props.map.things.filter((x) => x.pets && settings.world.tracked.includes(keyOf(props.map.id, x))).length : t === "item" || t === "route" ? 0 : tracked(t));
  return (
    <aside class="tracker" aria-label="Tracker">
      <div class="tracker-tabs" role="tablist" aria-label="What to track">
        <For each={TABS}>
          {(t) => (
            <button class="ui-chip" role="tab" aria-selected={tab() === t} onClick={() => setTab(t)}>
              {TAB_NAMES[t]}
              <Show when={countOf(t)}><span class="ui-num tracker-count">{countOf(t)}</span></Show>
            </button>
          )}
        </For>
      </div>
      <div class="tracker-body" role="tabpanel" aria-label={TAB_NAMES[tab()]}>
        <Switch>
          <Match when={tab() === "trace" || tab() === "cube"}><Findable layer={tab() as Layer} {...props} here={here()} /></Match>
          <Match when={tab() === "gather"}><Kinds layer="gather" {...props} here={here()} /></Match>
          <Match when={tab() === "monster"}><Kinds layer="monster" {...props} here={here()} search /></Match>
          <Match when={tab() === "pets"}><PetsHere {...props} /></Match>
          <Match when={tab() === "item"}><Items {...props} /></Match>
          <Match when={tab() === "route"}><Routes {...props} /></Match>
        </Switch>
      </div>
    </aside>
  );
}

function TrackButton(props: { key: string; name: string }) {
  const on = () => settings.world.tracked.includes(props.key);
  return (
    <button class="ui-chip" aria-pressed={on()} aria-label={`Track ${props.name}`} onClick={(e) => (e.stopPropagation(), toggleTrack(props.key))}>
      Track
    </button>
  );
}

/** Traces and cubes: how many you found, by region, and those left, nearest first. */
function Findable(props: TrackerProps & { layer: Layer; here: You | null }) {
  const thing = () => props.map.things.find((t) => t.layer === props.layer);
  const all = () => counted(props.map, props.layer, settings.world.found);
  const regions = () => byRegion(props.map, props.layer, settings.world.found);
  const left = () => (thing() ? nearest(props.map, [thing()!], settings.world.found, props.here, 30) : []);
  const word = () => (props.layer === "trace" ? "traces" : "cubes");
  return (
    <Show when={thing()} fallback={<p class="ui-muted ui-small">No {word()} on this map in the data.</p>}>
      {(t) => (
        <>
          <div class="tracker-head">
            <b class="ui-num">{all().done} of {all().all} found</b>
            <TrackButton key={keyOf(props.map.id, t())} name={`the ${word()} left`} />
          </div>
          <div class="tracker-bar" style={{ "--done": all().all ? all().done / all().all : 0, "--colour": LAYER_COLOURS[props.layer] }} />
          <Show when={props.layer === "cube"}>
            <p class="ui-muted ui-small">Where they can be, ticked as you open them. Which is up now is not shown: the game does not say.</p>
          </Show>
          <h3>By region</h3>
          <For each={regions()}>
            {(r) => (
              <button class="tracker-row" onClick={() => lookAtRegion(props, r.name)}>
                <span>{r.name || "Outside the regions"}</span>
                <span class="ui-num" classList={{ done: r.done === r.all }}>{r.done} of {r.all}</span>
              </button>
            )}
          </For>
          <h3>{props.here ? "Left, nearest first" : "Left"}</h3>
          <For each={left()}>
            {(n) => (
              <div class="tracker-row" role="button" tabindex="0" onClick={() => props.pick({ thing: n.thing, spot: n.spot })} onKeyDown={(e) => e.key === "Enter" && props.pick({ thing: n.thing, spot: n.spot })}>
                <span>{props.map.regions[n.spot.region]?.name ?? "Outside the regions"}</span>
                <span class="ui-num ui-muted">{props.here ? `${far(n.away)} ${height(n.up)}` : ""}</span>
                <button class="ui-chip" onClick={(e) => (e.stopPropagation(), tickFound(n.key, n.spot))}>Found</button>
              </div>
            )}
          </For>
        </>
      )}
    </Show>
  );
}

function lookAtRegion(props: TrackerProps, name: string) {
  const r = props.map.regions.find((x) => x.name === name);
  if (!r) return;
  const xs = r.shape.filter((_, i) => i % 2 === 0);
  const ys = r.shape.filter((_, i) => i % 2 === 1);
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  props.look({ x: (left + right) / 2, y: (top + bottom) / 2, across: Math.max(right - left, bottom - top) * 1.4 });
}

/** A kind of thing, at its nearest spot. */
function pickNearest(props: TrackerProps & { here: You | null }, t: Thing) {
  const [n] = nearest(props.map, [t], {}, props.here, 1);
  if (n) {
    props.pick({ thing: t, spot: n.spot });
    props.look({ x: n.spot.x, y: n.spot.y });
  }
}

/** Gathering nodes or monsters, each with how many spots. */
function Kinds(props: TrackerProps & { layer: "gather" | "monster"; here: You | null; search?: boolean }) {
  const [query, setQuery] = createSignal("");
  const [pets] = createResource(() => petFile().catch(() => null));
  const petName = (id: number) => pets()?.pets.find((p) => p.id === id)?.name ?? "";
  const all = createMemo(() =>
    props.map.things.filter((t) => (props.layer === "monster" ? t.layer === "monster" || t.layer === "boss" : t.layer === props.layer) && (!query() || matches(query(), t.name, t.sort))),
  );
  return (
    <>
      <Show when={props.search}>
        <input class="ui-input" type="search" placeholder="Search monsters" aria-label="Search monsters" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
      </Show>
      <Show when={all().length} fallback={<p class="ui-muted ui-small">None on this map.</p>}>
        <For each={all().slice(0, 300)}>
          {(t) => (
            <div class="tracker-row" role="button" tabindex="0" onClick={() => pickNearest(props, t)} onKeyDown={(e) => e.key === "Enter" && pickNearest(props, t)}>
              <span>
                <span class="dot" style={{ background: LAYER_COLOURS[t.layer] }} />
                {t.name}
                <Show when={t.level}><small class="ui-muted"> {t.level}</small></Show>
                <Show when={t.elite}><small class="tag"> Elite</small></Show>
                <Show when={t.layer === "boss"}><small class="tag"> Boss</small></Show>
                <Show when={t.sort}><small class="ui-muted"> {t.sort}</small></Show>
                <Show when={t.pets?.length}><small class="souls">Souls of {t.pets!.map(petName).filter(Boolean).join(", ")}</small></Show>
              </span>
              <span class="ui-num ui-muted">{spots(t).length}</span>
              <TrackButton key={keyOf(props.map.id, t)} name={t.name} />
            </div>
          )}
        </For>
      </Show>
    </>
  );
}

/** Pets whose souls drop on this map and that you still need. */
function PetsHere(props: TrackerProps) {
  const [file] = createResource(() => petFile().catch(() => null));
  const goal = () => settings.pets.goal;
  const needed = (p: Pet) => toGo(p, settings.pets.levels[p.id] ?? 0, settings.pets.souls[p.id] ?? 0, goal()) > 0;
  const rows = createMemo(() => {
    const pets = file()?.pets ?? [];
    return pets
      .filter(needed)
      .map((pet) => ({ pet, things: props.map.things.filter((t) => t.pets?.includes(pet.id)) }))
      .filter((r) => r.things.length);
  });
  const keys = () => rows().flatMap((r) => r.things.map((t) => keyOf(props.map.id, t)));
  const all = () => keys().length > 0 && keys().every((k) => settings.world.tracked.includes(k));
  return (
    <Show when={file()} fallback={<p class="ui-muted ui-small">The pet file is not on this PC.</p>}>
      <div class="tracker-head">
        <b>{rows().length} still needed here</b>
        <button class="ui-chip" aria-pressed={all()} onClick={() => change((s) => (s.world.tracked = all() ? s.world.tracked.filter((k) => !keys().includes(k)) : [...new Set([...s.world.tracked, ...keys()])]))}>
          Track all
        </button>
      </div>
      <p class="ui-muted ui-small">To level {goal()}. Change the goal on the Pets page.</p>
      <For each={rows()}>
        {(r) => (
          <div class="tracker-pet">
            <b>{r.pet.name} <small class="ui-muted">{KIND_NAMES[r.pet.kind]}, {toGo(r.pet, settings.pets.levels[r.pet.id] ?? 0, settings.pets.souls[r.pet.id] ?? 0, goal())} souls to go</small></b>
            <For each={r.things}>
              {(t) => (
                <div class="tracker-row" role="button" tabindex="0" onClick={() => pickNearest({ ...props, here: props.you }, t)} onKeyDown={(e) => e.key === "Enter" && pickNearest({ ...props, here: props.you }, t)}>
                  <span>{t.name} <small class="ui-muted">{t.level}</small></span>
                  <span class="ui-num ui-muted">{spots(t).length}</span>
                  <TrackButton key={keyOf(props.map.id, t)} name={t.name} />
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </Show>
  );
}

/** Search an item, see what gives it here, and how likely. */
function Items(props: TrackerProps) {
  const [drops] = createResource(() => dropFile().catch(() => null));
  const [query, setQuery] = createSignal("");
  const [item, setItem] = createSignal(0);
  const found = () => (drops() ? itemsLike(drops()!, query()) : []);
  const from = createMemo(() => {
    const d = drops();
    if (!d || !item()) return [];
    const chance = new Map(droppers(d, item()).map((x) => [x.npc, x.chance]));
    const mobs = props.map.things.filter((t) => t.npc && chance.has(t.npc)).map((t) => ({ t, chance: chance.get(t.npc!)! }));
    const nodes = props.map.things.filter((t) => t.items?.includes(item())).map((t) => ({ t, chance: -1 }));
    return [...mobs.sort((a, b) => b.chance - a.chance), ...nodes];
  });
  const elsewhere = () => (drops() && item() ? droppers(drops()!, item()).length : 0);
  return (
    <Show when={drops()} fallback={<p class="ui-muted ui-small">The drop file is not on this PC.</p>}>
      <input class="ui-input" type="search" placeholder="Search an item" aria-label="Search an item" value={query()} onInput={(e) => (setQuery(e.currentTarget.value), setItem(0))} />
      <Show when={item()} fallback={
        <For each={found()}>{(x) => <button class="tracker-row" data-grade={x.grade} onClick={() => setItem(x.item)}><span>{x.name}</span></button>}</For>
      }>
        <div class="tracker-head">
          <b>{drops()!.items[item()]?.[1]}</b>
          <button class="ui-chip" onClick={() => setItem(0)}>Back</button>
        </div>
        <p class="ui-muted ui-small">{from().length ? `${from().length} here.` : "Nothing on this map gives it."} {elsewhere()} monsters drop it in all.</p>
        <For each={from()}>
          {(x) => (
            <div class="tracker-row" role="button" tabindex="0" onClick={() => pickNearest({ ...props, here: props.you }, x.t)} onKeyDown={(e) => e.key === "Enter" && pickNearest({ ...props, here: props.you }, x.t)}>
              <span><span class="dot" style={{ background: LAYER_COLOURS[x.t.layer] }} />{x.t.name} <small class="ui-muted">{x.t.level || x.t.sort}</small></span>
              <span class="ui-num ui-muted">{x.chance < 0 ? "" : `${x.chance < 0.01 ? x.chance.toFixed(4) : x.chance.toFixed(2)}%`}</span>
              <TrackButton key={keyOf(props.map.id, x.t)} name={x.t.name} />
            </div>
          )}
        </For>
      </Show>
    </Show>
  );
}

/** Your own routes on this map: points in order, drawn by clicking. */
function Routes(props: TrackerProps) {
  const mine = () => settings.world.routes.filter((r) => r.map === props.map.id);
  const add = () => {
    const key = `route-${Date.now()}`;
    change((s) => (s.world.routes = [...s.world.routes, { key, name: `Route ${mine().length + 1}`, map: props.map.id, points: [] }]));
    props.setRoute(key);
    props.setDrawing(key);
  };
  const edit = (key: string, to: (points: number[]) => number[]) =>
    change((s) => (s.world.routes = s.world.routes.map((r) => (r.key === key ? { ...r, points: to(r.points) } : r))));
  return (
    <>
      <div class="tracker-head">
        <b>{mine().length} routes</b>
        <button class="ui-chip" onClick={add}>New route</button>
      </div>
      <Show when={props.drawing}>
        <p class="ui-small">Click the map to add points in order.</p>
        <div class="ui-row">
          <button class="ui-chip" onClick={() => edit(props.drawing, (p) => p.slice(0, -1))}>Take back a point</button>
          <button class="ui-button" data-main onClick={() => props.setDrawing("")}>Done</button>
        </div>
      </Show>
      <For each={mine()}>
        {(r) => (
          <div class="tracker-row">
            <input class="ui-input" aria-label="Name of the route" value={r.name} maxlength={60} onChange={(e) => change((s) => (s.world.routes = s.world.routes.map((x) => (x.key === r.key ? { ...x, name: e.currentTarget.value.trim() } : x))))} />
            <span class="ui-num ui-muted">{r.points.length}</span>
            <span class="ui-row">
              <button class="ui-chip" aria-pressed={props.route === r.key} onClick={() => props.setRoute(props.route === r.key ? "" : r.key)}>Show</button>
              <button class="ui-chip" onClick={() => (props.setRoute(r.key), props.setDrawing(r.key))}>Add</button>
              <button class="ui-icon-button" aria-label={`Delete ${r.name}`} onClick={() => change((s) => (s.world.routes = s.world.routes.filter((x) => x.key !== r.key)))}>{""}</button>
            </span>
          </div>
        )}
      </For>
    </>
  );
}

/** A point of a route, from a click on the map. */
export const routePoint = (key: string, at: { x: number; y: number }) =>
  change((s) => (s.world.routes = s.world.routes.map((r) => (r.key === key ? { ...r, points: [...r.points, pack(at.x, at.y)].slice(0, 500) } : r))));

