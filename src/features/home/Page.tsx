import { createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { openPage, worldFile } from "../../api";
import { GAME } from "../../app/brand";
import { ScreenPreview } from "../../app/Layouts";
import { NAV_GROUPS } from "../../app/menu";
import { lights } from "../../live/health";
import { engine, fight, live, near, state, waitingForYou } from "../../live/store";
import { activity, pick } from "../../overlay/rules";
import { settings } from "../../store";
import { place } from "../../store/settings";
import { GameIcon } from "../../ui/Pic";
import { FEATURES } from "../index";
import { energy } from "../characters/logic";
import { kept } from "../characters/watch";
import { resets, wait } from "../resources/logic";
import { upcoming } from "../time/logic";
import "./home.css";

/** Pages that are not features'. */
const MORE = [
  { id: "look", name: "Meter look", icon: "", color: "#e58cff" },
  { id: "overlays", name: "Overlays", icon: "", color: "#8f9bff" },
  { id: "settings", name: "Settings", icon: "", color: "#a9b4c8" },
];

/** One line for each page. */
const ABOUT: Record<string, string> = {
  meter: "Your party's damage, live, with each skill.",
  training: "Runs on a dummy, timed and kept.",
  bosses: "Each boss's skills and calls, and how you did.",
  auras: "Effects to watch, shown over the game.",
  alerts: "A sound or a banner when something needs you.",
  loot: "What dropped, and what it is worth.",
  history: "Every fight kept, by day and character.",
  resources: "Every character side by side: energy, entries, keys and tasks.",
  time: "Events, resets, a stopwatch and odds.",
  map: "The game's maps, with bosses, gathering and your place.",
  pets: "Every pet, where its souls drop, and what is left.",
  closet: "Skins you have, and where to get the rest.",
  builds: "Daevanion boards and stats, planned.",
  database: "Items, skills and monsters, searched.",
  look: "How the meter looks and what it shows.",
  overlays: "Which overlays are on, and where they stand.",
  settings: "Keys, sounds, start-up and the rest.",
};

export const greeting = (hour: number) => (hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

const picture = (name: string) => worldFile(name).then((b) => URL.createObjectURL(new Blob([b], { type: "image/webp" })));

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
  const layout = () => (settings.layoutAuto ? pick(settings.layouts, activity(near, fight.target.dummy), near.you?.name ?? "")?.name : undefined);
  const ready = () => lights(engine(), state(), GAME, !!near.you?.name);
  const game = () => ready()[2];
  const pages = () => [...FEATURES.filter((f) => f.page && f.id !== "home"), ...MORE];
  // NC's key art, which the engine's tools/marks.py fetches. Without it, the map you were last on.
  const [banner] = createResource(() => last()?.map || 1010, (id) => picture("home.webp").catch(() => picture(`map_${id}.webp`)).catch(() => picture("map_1010.webp")).catch(() => ""));
  onCleanup(() => banner() && URL.revokeObjectURL(banner()!));

  return (
    <div class="page">
      <header class="home-hero">
        <Show when={banner()}>{(url) => <img class="home-ground" src={url()} alt="" />}</Show>
        <div class="home-hello">
          <small class="home-brand">Plume for {GAME}</small>
          <h1>{greeting(new Date(now()).getHours())}{name() ? `, ${name()}` : ""}</h1>
          <p>{waitingForYou() ? "Waiting for your character: change zone, or go to character select and log back in." : live() ? `${GAME} is connected, and Plume reads it.` : `Plume reads ${GAME} once all three below are green.`}</p>
          <div class="home-chips">
            <span class="home-chip" data-light={game().light}>{live() ? `${GAME} is running` : `${GAME} is not running`}</span>
            <Show when={layout()}>{(l) => <span class="home-chip"><span class="ui-icon" aria-hidden="true">{""}</span>{l()}</span>}</Show>
            <span class="home-chip"><span class="ui-icon" aria-hidden="true">{""}</span>{overlays()} overlays on</span>
            <span class="home-chip"><span class="ui-icon" aria-hidden="true">{""}</span>{alerts()} alerts on</span>
          </div>
        </div>
      </header>
      <Show when={!live() || waitingForYou()}>
        <ul class="lights" aria-label="What is ready">
          <For each={ready()}>{(l) => <li data-light={l.light}>{l.name}<small>{l.about}</small></li>}</For>
        </ul>
      </Show>
      <div class="home-row">
        <section class="home-card home-screen">
          <ScreenPreview />
          <div class="home-card-text">
            <h2>Overlays</h2>
            <p class="ui-muted">{overlays()} on{settings.layouts.length ? `, ${settings.layouts.length} layouts${settings.layoutAuto ? " changing by themselves" : ""}` : ""}. Place them on a picture of your screen, or over the game itself.</p>
            <div class="ui-row">
              <button class="ui-button" data-main onClick={() => void openPage("overlays")}>Place overlays</button>
              <button class="ui-button" onClick={() => void openPage("look")}>Meter look</button>
            </div>
          </div>
        </section>
        <section class="home-card home-soon">
          <Show when={event()}>
            {(e) => (
              <button class="home-next" onClick={() => void openPage("time")}>
                <span class="thing-pic" aria-hidden="true"><GameIcon name={e().event.icon}><span class="ui-icon">{""}</span></GameIcon></span>
                <span><small>{e().open ? "Open now" : "Next event"}</small><b>{e().event.name}</b></span>
                <span class="ui-num ui-muted">{e().open ? "" : wait(e().start - now())}</span>
              </button>
            )}
          </Show>
          <div class="home-facts">
            <div><small>Daily reset</small><b class="ui-num">{wait(resets(now()).daily)}</b></div>
            <div><small>Weekly reset</small><b class="ui-num">{wait(resets(now()).weekly)}</b></div>
            <Show when={odyle() && odyle()!.value >= 0}>
              <div>
                <small>Odyle Energy, {last()!.name}</small>
                <b class="ui-num" classList={{ lost: !odyle()!.full }}>{odyle()!.value} / {odyle()!.most}</b>
                <small>{odyle()!.full ? `full in ${wait(odyle()!.full)}` : "Full: going to waste"}</small>
              </div>
            </Show>
          </div>
        </section>
      </div>
      <nav class="home-groups" aria-label="Every page">
        <For each={NAV_GROUPS}>
          {(g) => (
            <section class="home-group" style={{ "--group": g.color }}>
              <h3>{g.name}</h3>
              <div class="home-tiles">
                <For each={g.ids.map((id) => pages().find((p) => p.id === id)).filter((p) => p !== undefined)}>
                  {(p) => (
                    <button class="home-tile" style={{ "--icon-color": p.color }} onClick={() => void openPage(p.id)}>
                      <span class="ui-icon" aria-hidden="true">{p.icon}</span>
                      <span><b>{p.name}</b><small>{ABOUT[p.id] ?? ""}</small></span>
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
