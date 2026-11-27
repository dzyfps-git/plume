import { createEffect, createMemo, createResource, createSignal, For, on, Show } from "solid-js";
import { change, settings } from "../../store";
import { LAYERS, type Layer } from "../../store/settings";
import { GameIcon } from "../../ui/Pic";
import { Waiting } from "../../ui/Waiting";
import { live } from "../../live/store";
import { MapCanvas, type Picked } from "./Canvas";
import { dropFile, itemFile, petFile, useMap, useMaps, useYou, type You } from "./data";
import { dropsOf, far, FINDABLE, FLAT, height, isFound, keyOf, LAYER_COLOURS, LAYER_NAMES, markOf, metres, SIDE_NAMES, teleportNear, type MapInfo, type WorldMap } from "./logic";
import { routePoint, tickFound, toggleTrack, Tracker } from "./Tracker";
import "./map.css";

export function MapPage() {
  const maps = useMaps();
  const you = useYou();
  const listed = (id: number) => maps()?.maps.some((m) => m.id === id) ?? false;
  /** The map chosen, or the one you are on, or the first. */
  const id = createMemo(() => {
    const chosen = settings.world.map;
    if (chosen && listed(chosen)) return chosen;
    const at = you()?.map ?? 0;
    return listed(at) ? at : chosen ? 0 : (maps()?.maps.find((m) => m.marks > 0)?.id ?? 0);
  });
  const { map, picture } = useMap(id);
  const [picked, setPicked] = createSignal<Picked | null>(null);
  const [look, setLook] = createSignal<{ x: number; y: number; across?: number } | null>(null);
  const [drawing, setDrawing] = createSignal("");
  const [route, setRoute] = createSignal("");
  const tracked = createMemo(() => new Set(settings.world.tracked));
  const shownRoute = () => settings.world.routes.find((r) => r.key === route() && r.map === id())?.points;
  createEffect(on(id, () => (setPicked(null), setDrawing(""), setRoute(""))));

  const counts = createMemo(() => {
    const m = map();
    const out: Partial<Record<Layer, number>> = {};
    for (const t of m?.things ?? []) out[t.layer] = (out[t.layer] ?? 0) + t.spots.length / 5;
    return out;
  });
  const choose = (n: number) => change((s) => (s.world.map = n));
  // As the canvas follows: only while you are on the map it shows.
  const following = () => !!you()?.known && you()!.map === id();
  const set = <K extends "follow" | "hideFound">(key: K) => (on: boolean) => change((s) => (s.world[key] = on));

  return (
    <div class="page map-page">
      <header class="page-head">
        <h1>Map</h1>
        <Show when={you()} fallback={<small class="ui-muted map-said">{settings.world.follow ? "Follow me waits for your place: change zone, teleport or dash, and it shows." : "Your place shows once the game says it."}</small>}>
          {(y) => <YouSaid you={y()} map={map()} />}
        </Show>
        <button class="ui-chip" aria-pressed={settings.world.follow} onClick={() => set("follow")(!settings.world.follow)}>
          <span class="ui-icon" aria-hidden="true">{"\ue707"}</span>
          Follow me
          <Show when={settings.world.follow}><i class="follow-light" data-on={following() || undefined} aria-label={following() ? "following" : "waiting for your place on this map"} /></Show>
        </button>
        <button class="ui-chip" aria-pressed={settings.world.hideFound} onClick={() => set("hideFound")(!settings.world.hideFound)}>
          <span class="ui-icon" aria-hidden="true">{"\ue73e"}</span>
          Hide found
        </button>
      </header>
      <Show when={maps() !== null} fallback={<NoFiles />}>
        <div class="map-layers ui-row" role="group" aria-label="Layers">
          {/* Every layer always, so the row keeps its size from one map to the next; one this map lacks is dimmed. */}
          <For each={LAYERS}>
            {(l) => (
              <button class="ui-chip" disabled={!counts()[l]} aria-pressed={settings.world.layers.includes(l)} onClick={() => change((s) => (s.world.layers = s.world.layers.includes(l) ? s.world.layers.filter((x) => x !== l) : [...s.world.layers, l]))}>
                <Show when={markOf(l, map()?.side)} fallback={<span class="dot" style={{ background: LAYER_COLOURS[l] }} />}>
                  {(name) => <span class="chip-pic" aria-hidden="true"><GameIcon name={name()}><span class="dot" style={{ background: LAYER_COLOURS[l] }} /></GameIcon></span>}
                </Show>
                {LAYER_NAMES[l]}
                <small class="ui-num ui-muted">{counts()[l] ?? 0}</small>
              </button>
            )}
          </For>
        </div>
        <div class="map-grid">
          <nav class="map-list" aria-label="Maps">
            <Show when={you() && !listed(you()!.map)}>
              <p class="ui-muted ui-small">You are where there is no map: a dungeon, an arena or a house.</p>
            </Show>
            <button class="tracker-row" aria-current={!settings.world.map || undefined} onClick={() => choose(0)}>
              <span>Where I am</span>
            </button>
            <For each={["asmodian", "elyos", "abyss"] as MapInfo["side"][]}>
              {(side) => (
                <>
                  <h3 class="tint-text" data-side={side}><span class="tint-dot" aria-hidden="true" />{SIDE_NAMES[side]}</h3>
                  <For each={maps()?.maps.filter((m) => m.side === side)}>
                    {(m) => (
                      <button class="tracker-row" data-side={side} aria-current={(settings.world.map === m.id) || undefined} onClick={() => choose(m.id)}>
                        <span>{m.name}</span>
                        <small class="ui-num ui-muted">{m.marks ? m.marks.toLocaleString("en-GB") : "picture"}</small>
                      </button>
                    )}
                  </For>
                </>
              )}
            </For>
            <Show when={map()?.regions.length}>
              <h3>Regions</h3>
              <For each={map()!.regions}>
                {(r) => (
                  <button class="tracker-row" onClick={() => {
                    const xs = r.shape.filter((_, i) => i % 2 === 0);
                    const ys = r.shape.filter((_, i) => i % 2 === 1);
                    setLook({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, across: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.4 });
                    change((s) => (s.world.follow = false));
                  }}>
                    <span>{r.name}</span>
                  </button>
                )}
              </For>
            </Show>
          </nav>
          <div class="map-view">
            <Show when={map()} fallback={<div class="ui-empty"><p>{map.loading || maps.loading ? "Reading the map." : "Pick a map on the left."}</p></div>}>
              {(m) => (
                <>
                  <MapCanvas
                    map={m()}
                    picture={picture()}
                    layers={settings.world.layers}
                    found={settings.world.found}
                    hideFound={settings.world.hideFound}
                    tracked={tracked()}
                    you={you()}
                    route={shownRoute()}
                    picked={picked()}
                    follow={settings.world.follow}
                    look={look}
                    onMoved={() => settings.world.follow && change((s) => (s.world.follow = false))}
                    onPick={(p, at) => (drawing() ? routePoint(drawing(), at) : setPicked(p))}
                  />
                  <Show when={picked()}>{(p) => <Card map={m()} picked={p()} you={you()} close={() => setPicked(null)} />}</Show>
                  <Show when={!m().things.length}><p class="map-note ui-small">Only a picture of this map was found: no marks.</p></Show>
                </>
              )}
            </Show>
          </div>
          <Show when={map()}>
            {(m) => <Tracker map={m()} you={you()} pick={(p) => (setPicked(p), change((s) => (s.world.follow = false)))} look={(at) => (setLook(at), settings.world.follow && change((s) => (s.world.follow = false)))} drawing={drawing()} setDrawing={setDrawing} route={route()} setRoute={setRoute} />}
          </Show>
        </div>
      </Show>
      <Show when={!live() && maps()}>
        <div class="map-wait"><Waiting idle="Your place shows as the game says it: as you load, teleport, dash or put a buff on." /></div>
      </Show>
    </div>
  );
}

function NoFiles() {
  return (
    <div class="ui-empty">
      <span class="ui-icon" aria-hidden="true">{"\ue909"}</span>
      <p>The map files are not on this PC. The engine's tools/world.py writes them into Plume's world folder.</p>
    </div>
  );
}

/** How old your place is, and whether it is a guess. */
function YouSaid(props: { you: You; map?: WorldMap | null }) {
  const words = () => {
    const y = props.you;
    if (!y.known) return "Your place comes once the game says it on this map.";
    const age = Math.round(y.age / 1000);
    const said = age < 2 ? "said now" : `said ${age < 90 ? `${age} s` : `${Math.round(age / 60)} min`} ago`;
    return y.guess ? `Your place is a guess, ${said}` : `Your place, ${said}`;
  };
  return <small class="ui-muted map-said">{words()}</small>;
}

/** What a mark is, and what can be done with it. */
function Card(props: { map: WorldMap; picked: Picked; you: You | null; close: () => void }) {
  const t = () => props.picked.thing;
  const s = () => props.picked.spot;
  const key = () => keyOf(props.map.id, t());
  // A card stays open while other marks are picked, so the files load whatever the first mark was.
  const [drops] = createResource(() => dropFile().catch(() => null));
  const [pets] = createResource(() => petFile().catch(() => null));
  const here = () => (props.you?.known && props.you.map === props.map.id ? props.you : null);
  const found = () => isFound(settings.world.found, key(), s());
  const teleport = () => (t().layer === "teleport" ? null : teleportNear(props.map, s()));
  const [items] = createResource(() => itemFile().catch(() => null));
  const iconOf = (item: number) => items()?.items[String(item)]?.[2];
  /** Its picture: the pet whose souls it gives, else what it gives, else its kind of mark. */
  const pic = () => {
    const pet = t().pets?.length ? pets()?.pets.find((x) => x.id === t().pets![0]) : undefined;
    return (pet?.market && iconOf(pet.market)) || (t().items?.length && iconOf(t().items![0])) || markOf(t().layer, props.map.side);
  };
  return (
    <section class="map-card ui-card" aria-label={t().name}>
      <div class="map-card-head">
        <span class="thing-pic map-card-pic" style={{ "--tint": LAYER_COLOURS[t().layer] }} aria-hidden="true">
          <Show when={pic()} fallback={<span class="dot" style={{ background: LAYER_COLOURS[t().layer] }} />}>
            {(name) => <GameIcon name={name()}><span class="dot" style={{ background: LAYER_COLOURS[t().layer] }} /></GameIcon>}
          </Show>
        </span>
        <b>{t().name}</b>
        <button class="ui-icon-button" aria-label="Close" onClick={props.close}>{"\ue711"}</button>
      </div>
      <small class="ui-muted">
        {LAYER_NAMES[t().layer]}
        <Show when={t().level}>, level {t().level}</Show>
        <Show when={t().elite}>, elite</Show>
        <Show when={t().sort}>, {t().sort}</Show>
      </small>
      <small>{[props.map.regions[s().region]?.name, props.map.zones[s().zone]].filter((x, i, all) => x && all.indexOf(x) === i).join(", ") || "Outside the regions"}</small>
      <Show when={here()}>{(y) => <small class="ui-num">{far(metres(s(), y()))} from you {FLAT.includes(t().layer) ? "" : height(s().z - y().z)}</small>}</Show>
      <Show when={teleport()}>{(tp) => <small>Nearest teleport: {tp().name}, {far(tp().away)}</small>}</Show>
      <Show when={t().pets?.length ? pets() : null}>{(p) => <small class="souls">Souls of {t().pets!.map((id) => p().pets.find((x) => x.id === id)?.name).filter(Boolean).join(", ")}</small>}</Show>
      <Show when={drops() && t().items?.length}>
        <small>Gives {(t().items ?? []).map((i) => drops()!.items[i]?.[1]).filter(Boolean).join(", ")}</small>
      </Show>
      <Show when={drops() && t().npc && dropsOf(drops()!, t().npc!).length}>
        <ul class="map-drops">
          <For each={dropsOf(drops()!, t().npc!).slice(0, 8)}>
            {(d) => <li data-grade={d.grade}><span class="thing-pic" data-small aria-hidden="true"><Show when={iconOf(d.item)}>{(name) => <GameIcon name={name()}>{null}</GameIcon>}</Show></span><span>{d.name}</span><span class="ui-num ui-muted">{d.chance < 0.01 ? d.chance.toFixed(4) : d.chance.toFixed(2)}%</span></li>}
          </For>
        </ul>
      </Show>
      <div class="ui-row">
        <button class="ui-chip" aria-pressed={settings.world.tracked.includes(key())} onClick={() => toggleTrack(key())}>Track</button>
        <Show when={FINDABLE.includes(t().layer)}>
          <button class="ui-chip" aria-pressed={found()} onClick={() => tickFound(key(), s())}>Found</button>
        </Show>
      </div>
    </section>
  );
}
