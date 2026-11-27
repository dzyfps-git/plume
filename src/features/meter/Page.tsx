import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { engineSend } from "../../api";
import { fight, near, skills } from "../../live/store";
import { change, hideNames, settings } from "../../store";
import { MODES, VIEWS, type Mode, type View } from "../../store/settings";
import { ClassMark, classOf } from "../../ui/classes";
import { clock, full, short } from "../../ui/format";
import { Thing } from "../../ui/icons";
import { label, partyDps, power, ranked, VIEW_NAMES, whose } from "./logic";
import { Skills } from "./Skills";
import { Waiting } from "../../ui/Waiting";
import "./meter.css";
import "./page.css";

const MODE_NAMES: Record<Mode, string> = {
  bossTargets: "Bosses and dummies",
  lastHitByMe: "What you hit last",
  mostRecent: "What was hit last",
  mostDamage: "What took the most",
  allTargets: "Everything",
};

export function MeterPage() {
  const [picked, setPicked] = createSignal<number>();
  const list = createMemo(() => ranked({ rows: whose(fight.rows, settings.meter.who, new Set(near.party.map((u) => u.id))), ms: fight.ms }, settings.meter.view));
  // Of the rows shown: another player picked under Everyone is not watched once You alone shows.
  const row = createMemo(() => {
    const rows = list().map((x) => x.row);
    return rows.find((r) => r.id === picked()) ?? rows.find((r) => r.you) ?? rows[0];
  });
  // A row is drawn once per player and only its numbers change, so the button you are on keeps the focus.
  const ids = createMemo(() => list().map((x) => x.row.id), [], { equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]) });
  const of = (id: number) => list().find((x) => x.row.id === id)!;
  // The engine works out the skills of one player, and only while they are looked at.
  const watched = createMemo(() => row()?.id);
  createEffect(() => void engineSend({ cmd: "watch", id: watched() ?? null }).catch(console.error));
  onCleanup(() => void engineSend({ cmd: "watch", id: null }).catch(console.error));

  return (
    <div class="page">
      <header class="page-head">
        <h1>{fight.target.name || "Damage meter"}</h1>
        <select
          class="ui-select"
          aria-label="What counts"
          value={settings.mode}
          onChange={(e) => change((s) => (s.mode = e.currentTarget.value as Mode))}
        >
          <For each={MODES}>{(mode) => <option value={mode}>{MODE_NAMES[mode]}</option>}</For>
        </select>
        <select
          class="ui-select"
          aria-label="What the meter shows"
          value={settings.meter.view}
          onChange={(e) => change((s) => (s.meter.view = e.currentTarget.value as View))}
        >
          <For each={VIEWS}>{(view) => <option value={view}>{VIEW_NAMES[view]}</option>}</For>
        </select>
        <select class="ui-select" aria-label="Whose rows show" value={settings.meter.who} onChange={(e) => change((s) => (s.meter.who = e.currentTarget.value as typeof s.meter.who))}>
          <option value="everyone">Everyone</option>
          <option value="party">Your party</option>
          <option value="me">You alone</option>
        </select>
        <button class="ui-button" onClick={() => void engineSend({ cmd: "reset" })}>
          <span class="ui-icon" aria-hidden="true">{""}</span>
          Start again
        </button>
      </header>
      <Show when={fight.rows.length} fallback={<Waiting idle="Hit a boss or a training dummy, and it shows here." />}>
        <div class="stats">
          <div class="stat" data-hero>
            <small>Party damage a second</small>
            <b class="ui-num">{short(partyDps(fight))}</b>
          </div>
          <div class="stat">
            <small>Total</small>
            <b class="ui-num" data-tip={full(fight.total)}>{short(fight.total)}</b>
          </div>
          <div class="stat">
            <small>Time</small>
            <b class="ui-num">{clock(fight.ms)}</b>
          </div>
          <div class="stat">
            <small>You</small>
            <b class="ui-num">{short(fight.rows.find((r) => r.you)?.dps ?? 0)}</b>
          </div>
        </div>
        <div class="board">
          <For each={ids()}>
            {(id, i) => {
              const r = () => of(id).row;
              return (
                <button
                  class="board-row"
                  aria-pressed={id === row()?.id}
                  onClick={() => setPicked(id)}
                  style={{ "--class": classOf(r().job).color, "--length": of(id).total / Math.max(1, list()[0].total) }}
                >
                  <i class="meter-bar" />
                  <ClassMark job={r().job} />
                  <span class="meter-name">{label(r(), hideNames(), i() + 1)}<Show when={r().power > 0 && !settings.discreet}><small class="meter-power ui-num"><Thing of="power" />{power(r().power)}</small></Show></span>
                  <small class="ui-num">{short(of(id).total)}</small>
                  <small class="ui-num">{of(id).share.toFixed(1)}%</small>
                  <b class="ui-num">{settings.meter.view === "hits" ? of(id).rate.toFixed(1) : short(of(id).rate)}</b>
                </button>
              );
            }}
          </For>
        </div>
        <Show when={settings.meter.view.endsWith("dps")}>
          <p class="ui-muted ui-small">What buffs add is measured from this fight, so it takes a while and stays an estimate. One target at a time.</p>
        </Show>
        <Show when={row()}>
          {(r) => (
            <section class="block">
              <h2>{label(r(), hideNames(), fight.rows.indexOf(r()) + 1)}</h2>
              <Show when={skills().id === r().id && skills().skills.length} fallback={<p class="ui-muted">Reading skills.</p>}>
                <Skills skills={skills().skills} job={r().job} />
              </Show>
            </section>
          )}
        </Show>
      </Show>
    </div>
  );
}
