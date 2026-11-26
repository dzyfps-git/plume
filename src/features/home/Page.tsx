import { createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { openPage, worldFile } from "../../api";
import { NAV_GROUPS } from "../../app/menu";
import { GameIcon } from "../../ui/Pic";
import { GAME } from "../../app/brand";
import { lights } from "../../live/health";
import { engine, live, near, state } from "../../live/store";
import { settings } from "../../store";
import { place } from "../../store/settings";
import { FEATURES } from "../index";
import { energy } from "../characters/logic";
import { kept } from "../characters/watch";
import { resets, wait } from "../resources/logic";
import { upcoming } from "../time/logic";
import "./home.css";

/** Pages that are not features'. */
const MORE = [
  { id: "look", name: "Meter look", icon: "\ue790", color: "#e58cff" },
  { id: "overlays", name: "Overlays", icon: "\ue7f4", color: "#8f9bff" },
  { id: "settings", name: "Settings", icon: "\ue713", color: "#a9b4c8" },
];

export const greeting = (hour: number) => (hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

export function HomePage() {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 30_000);
  onCleanup(() => clearInterval(timer));
  const last = () => Object.values(kept()).sort((a, b) => b.at - a.at)[0];
  const name = () => near.you?.name || last()?.name || "";
  const overlays = () => FEATURES.filter((f) => f.overlay && place(settings.places[f.id], f.overlay.place).on).length;
  const alerts = () => Object.values(settings.alerts).filter((a) => a.on).length;
  const event = () => upcoming(now(), settings.events.off)[0];
  const odyle = () => (last() ? energy(last()!, settings.odyle.member, now()) : undefined);
  const pages = () => [...FEATURES.filter((f) => f.page && f.id !== "home"), ...MORE];
  // The map you were last on, or Verteron, behind the greeting. A dungeon has no picture, so Verteron stands in.
  const [ground] = createResource(
    () => last()?.map || 1010,
    (id) => worldFile(`map_${id}.webp`).catch(() => worldFile("map_1010.webp")).then((b) => URL.createObjectURL(new Blob([b], { type: "image/webp" })), () => ""),
  );
  onCleanup(() => ground() && URL.revokeObjectURL(ground()!));

  return (
    <div class="page">
      <header class="home-hero">
        <Show when={ground()}>{(url) => <img class="home-ground" src={url()} alt="" />}</Show>
        <Show when={last()?.job}>{(job) => <span class="home-art" aria-hidden="true"><GameIcon name={`art_${job()}`}>{null}</GameIcon></span>}</Show>
        <div class="home-hello">
          <h1>{greeting(new Date(now()).getHours())}{name() ? `, ${name()}` : ""}</h1>
          <small>{live() ? `${GAME} is connected, and Plume reads it.` : `Plume reads ${GAME} once all three below are green.`}</small>
        </div>
      </header>
      <Show when={!live()}>
        <ul class="lights" aria-label="What is ready">
          <For each={lights(engine(), state(), GAME)}>{(l) => <li data-light={l.light}>{l.name}<small>{l.about}</small></li>}</For>
        </ul>
      </Show>
      <div class="stats">
        <Show when={event()}>
          {(e) => <div class="stat" data-hero><small>{e().open ? "Open now" : "Next event"}</small><b>{e().event.name}</b><small class="ui-num">{e().open ? "" : `in ${wait(e().start - now())}`}</small></div>}
        </Show>
        <div class="stat"><small>Daily reset in</small><b class="ui-num">{wait(resets(now()).daily)}</b></div>
        <Show when={odyle() && odyle()!.value >= 0}>
          <div class="stat"><small>Odyle Energy of {last()!.name}</small><b class="ui-num">{odyle()!.value} of {odyle()!.most}</b><small>{odyle()!.full ? `full in ${wait(odyle()!.full)}` : "Full: going to waste"}</small></div>
        </Show>
        <div class="stat"><small>Overlays on</small><b class="ui-num">{overlays()}</b><small>{settings.layoutAuto && settings.layouts.length ? `${settings.layouts.length} layouts, changing by themselves` : ""}</small></div>
        <div class="stat"><small>Alerts on</small><b class="ui-num">{alerts()}</b></div>
      </div>
      <nav class="home-groups" aria-label="Every page">
        <For each={NAV_GROUPS}>
          {(g) => (
            <section class="home-group" style={{ "--group": g.color }}>
              <h3><span class="tint-dot" style={{ "--tint": g.color }} aria-hidden="true" />{g.name}</h3>
              <div class="home-tiles">
                <For each={g.ids.map((id) => pages().find((p) => p.id === id)).filter((p) => p !== undefined)}>
                  {(p) => (
                    <button class="home-tile" onClick={() => void openPage(p.id)}>
                      <span class="ui-icon" aria-hidden="true" style={{ "--icon-color": p.color }}>{p.icon}</span>
                      <span>{p.name}</span>
                    </button>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
      </nav>
    </div>
  );
}
