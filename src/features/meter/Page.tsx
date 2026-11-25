import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { engineSend } from "../../api";
import { fight, skills } from "../../live/store";
import { change, hideNames, settings } from "../../store";
import { MODES, VIEWS, type Mode, type View } from "../../store/settings";
import { ClassMark, classOf } from "../../ui/classes";
import { clock, full, short } from "../../ui/format";
import { Thing } from "../../ui/icons";
import { label, partyDps, power, ranked, VIEW_NAMES } from "./logic";
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
  const row = createMemo(() => fight.rows.find((r) => r.id === picked()) ?? fight.rows.find((r) => r.you) ?? fight.rows[0]);
  const list = createMemo(() => ranked(fight, settings.meter.view));
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
          <For each={list()}>
            {({ row: r, total, rate, share }, i) => (
              <button
                class="board-row"
                aria-pressed={r.id === row()?.id}
                onClick={() => setPicked(r.id)}
                style={{ "--class": classOf(r.job).color, "--length": total / Math.max(1, list()[0].total) }}
              >
                <i class="meter-bar" />
                <ClassMark job={r.job} />
                <span class="meter-name">{label(r, hideNames(), i() + 1)}<Show when={r.power > 0 && !settings.discreet}><small class="meter-power ui-num"><Thing of="power" />{power(r.power)}</small></Show></span>
                <small class="ui-num">{short(total)}</small>
                <small class="ui-num">{share.toFixed(1)}%</small>
                <b class="ui-num">{settings.meter.view === "hits" ? rate.toFixed(1) : short(rate)}</b>
              </button>
            )}
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
