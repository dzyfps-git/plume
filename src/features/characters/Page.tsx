import { For, Show } from "solid-js";
import { settings } from "../../store";
import { CLASSES } from "../../ui/classes";
import { day, full, time } from "../../ui/format";
import { Thing } from "../../ui/icons";
import { Waiting } from "../../ui/Waiting";
import { showFightsOf } from "../history/Page";
import { power } from "../meter/logic";
import { useMaps } from "../map/data";
import { minutes } from "../resources/Overlay";
import { resets, wait } from "../resources/logic";
import { energy, lines, order } from "./logic";
import { forget, kept } from "./watch";
import "../resources/resources.css";

export function CharactersPage() {
  const now = minutes();
  const maps = useMaps();
  const member = () => settings.odyle.member;
  const all = () => order(Object.values(kept()), settings.resources, member(), now());
  const mapName = (id: number) => maps()?.maps.find((m) => m.id === id)?.name ?? "";
  return (
    <div class="page">
      <header class="page-head">
        <h1>Characters</h1>
        <span class="ui-muted ui-num">Daily reset in {wait(resets(now()).daily)}, weekly in {wait(resets(now()).weekly)}</span>
      </header>
      <Show when={all().length} fallback={<Waiting idle="Each character is kept here as you play it." />}>
        <p class="ui-muted ui-small">What goes to waste first comes first. Numbers are as last seen, with what came back since in whole steps: about, and never more.</p>
        <div class="chars">
          <For each={all()}>
            {(k) => {
              const e = () => energy(k, member(), now());
              return (
                <section class="block char">
                  <h2>{k.name} <Show when={CLASSES[k.job as keyof typeof CLASSES]}>{(c) => <span class="ui-muted ui-small">{c().name}</span>}</Show></h2>
                  <small class="ui-muted">Seen {day(k.at, now()).toLowerCase()}, {time(k.at)}<Show when={mapName(k.map)}>{(m) => `, in ${m()}`}</Show></small>
                  <div class="stats">
                    <Show when={k.power}><div class="stat"><small>Combat Power</small><b class="ui-num"><Thing of="power" />{power(k.power!)}</b></div></Show>
                    <Show when={k.level}><div class="stat"><small>Item level</small><b class="ui-num">{full(k.level!)}</b></div></Show>
                    <Show when={e().value >= 0}>
                      <div class="stat" data-hero>
                        <small>Odyle Energy</small>
                        <b class="ui-num">{full(e().value)} of {full(e().most)}</b>
                        <small classList={{ lost: !e().full }}>{e().full ? `full in ${wait(e().full)}` : "Full: going to waste"}</small>
                      </div>
                    </Show>
                    <Show when={k.kinah >= 0}><div class="stat"><small>Kinah today</small><b class="ui-num">{full(k.kinah)}</b></div></Show>
                    <Show when={k.points[0] >= 0}><div class="stat"><small>Abyss Points this week</small><b class="ui-num">{full(k.points[0])} of {full(k.points[1])}</b></div></Show>
                    <Show when={k.duty[0] >= 0}><div class="stat"><small>Daily Duties</small><b class="ui-num">{k.duty[0]} of {k.duty[1]}</b></div></Show>
                  </div>
                  <For each={lines(k, settings.resources, member(), now())}>
                    {(l) => (
                      <div class="ui-row-item">
                        <span>{l.name}</span>
                        <span class="ui-num" classList={{ lost: l.lost }}>{l.value} of {l.most}{l.lost ? ", more is lost at the reset" : ""}</span>
                      </div>
                    )}
                  </For>
                  <div class="ui-row">
                    <button class="ui-button" onClick={() => showFightsOf(k.name)}>Fights</button>
                    <button class="ui-button" onClick={() => forget(k.name)}>Forget</button>
                  </div>
                </section>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
