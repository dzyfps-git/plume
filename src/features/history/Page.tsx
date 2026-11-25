import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";
import { deleteFight, fight as loadFight } from "../../api";
import type { FightRow, Saved } from "../../live/types";
import { NAME } from "../../app/brand";
import { settings } from "../../store";
import { ClassMark, classOf } from "../../ui/classes";
import { clock, day, full, percent, short, time } from "../../ui/format";
import { label, length } from "../meter/logic";
import { Skills } from "../meter/Skills";
import { Chart } from "./Chart";
import { bestOf, bests, byDay, filtered, type Filter } from "./logic";
import { fights, followFights, forgetFight } from "./store";
import "../meter/meter.css";
import "../meter/page.css";
import "./history.css";

const FILTERS: [Filter, string][] = [["all", "All"], ["bosses", "Bosses"], ["kills", "Kills"], ["dummies", "Dummies"]];

export function HistoryPage() {
  followFights();
  const [filter, setFilter] = createSignal<Filter>("all");
  const [search, setSearch] = createSignal("");
  const [picked, setPicked] = createSignal<string>();
  const best = createMemo(() => bests(fights()));
  const list = createMemo(() => filtered(fights(), filter(), search()));
  const open = createMemo(() => list().find((f) => f.id === picked()) ?? list()[0]);

  return (
    <div class="page history">
      <header class="page-head">
        <h1>History</h1>
        <div class="ui-row" role="radiogroup" aria-label="Show">
          <For each={FILTERS}>
            {([id, name]) => (
              <button class="ui-chip" role="radio" aria-checked={filter() === id} onClick={() => setFilter(id)}>{name}</button>
            )}
          </For>
        </div>
        <input class="ui-input" placeholder="Search targets" aria-label="Search targets" onInput={(e) => setSearch(e.currentTarget.value)} />
      </header>
      <Show
        when={list().length}
        fallback={
          <div class="ui-empty">
            <span class="ui-icon" aria-hidden="true">{""}</span>
            <p>{fights().length ? "No fight matches." : "Your boss and dummy fights are kept here. Only your own numbers are written down."}</p>
          </div>
        }
      >
        <div class="history-panes">
          <div class="history-list">
            <For each={byDay(list(), day)}>
              {([name, items]) => (
                <>
                  <div class="ui-heading">{name}</div>
                  <For each={items}>
                    {(f) => (
                      <button class="ui-row-item history-item" aria-selected={f.id === open()?.id} onClick={() => setPicked(f.id)}>
                        <span class="history-name">
                          {f.target}
                          <Show when={bestOf(best(), f)?.id === f.id}>
                            <span class="ui-tag" style={{ "--tag": "var(--accent)" }}>Best</span>
                          </Show>
                        </span>
                        <b class="ui-num">{short(f.you?.dps ?? 0)}</b>
                        <small class="ui-muted ui-num">
                          {time(f.start)}, {clock(f.ms)}{f.dummy ? "" : f.killed ? ", killed" : ", not killed"}
                        </small>
                      </button>
                    )}
                  </For>
                </>
              )}
            </For>
          </div>
          <Show when={open()}>{(f) => <Detail fight={f()} best={bestOf(best(), f())} />}</Show>
        </div>
      </Show>
    </div>
  );
}

function Detail(props: { fight: Saved; best?: Saved }) {
  const [whole] = createResource(() => props.fight.id, loadFight);
  const [behind] = createResource(
    () => (props.best && props.best.id !== props.fight.id ? props.best.id : undefined),
    loadFight,
  );
  const [picked, setPicked] = createSignal<number>();
  createEffect(() => {
    props.fight.id;
    setPicked(undefined);
  });
  const rows = (): FightRow[] => whole()?.rows ?? (whole()?.you ? [whole()!.you!] : []);
  const row = () => rows().find((r) => r.id === picked()) ?? rows().find((r) => r.you) ?? rows()[0];

  return (
    <section class="history-detail">
      <header class="page-head">
        <h2>{props.fight.target}</h2>
        <button
          class="ui-icon-button"
          aria-label="Delete this fight"
          onClick={() => void deleteFight(props.fight.id).then(() => forgetFight(props.fight.id)).catch(console.error)}
        >
          {""}
        </button>
      </header>
      <div class="stats">
        <div class="stat" data-hero>
          <small>You, a second</small>
          <b class="ui-num">{short(props.fight.you?.dps ?? 0)}</b>
        </div>
        <div class="stat">
          <small>Your damage</small>
          <b class="ui-num" data-tip={full(props.fight.you?.damage ?? 0)}>{short(props.fight.you?.damage ?? 0)}</b>
        </div>
        <div class="stat">
          <small>Your share of {props.fight.players}</small>
          <b class="ui-num">{percent(props.fight.you?.damage ?? 0, props.fight.total)}</b>
        </div>
        <div class="stat">
          <small>Time</small>
          <b class="ui-num">{clock(props.fight.ms)}</b>
        </div>
      </div>
      <Show when={whole()}>
        {(w) => (
          <>
            <Chart curve={w().curve ?? []} best={behind()?.id === props.best?.id ? behind()?.curve : undefined} />
            <Show when={w().rows}>
              <div class="board">
                <For each={rows()}>
                  {(r, i) => (
                    <button
                      class="board-row"
                      aria-pressed={r.id === row()?.id}
                      onClick={() => setPicked(r.id)}
                      style={{ "--class": classOf(r.job).color, "--length": length(r, rows()) }}
                    >
                      <i class="meter-bar" />
                      <ClassMark job={r.job} />
                      <span class="meter-name">{label(r, settings.meter.hideNames, i() + 1)}</span>
                      <small class="ui-num">{short(r.damage)}</small>
                      <small class="ui-num">{r.share.toFixed(1)}%</small>
                      <b class="ui-num">{short(r.dps)}</b>
                    </button>
                  )}
                </For>
              </div>
              <p class="ui-muted ui-small">Other players are gone when {NAME} closes.</p>
            </Show>
            <Show when={row()}>{(r) => <Skills skills={r().skills ?? []} job={r().job} />}</Show>
          </>
        )}
      </Show>
    </section>
  );
}
