import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { engineSend } from "../../api";
import { fight, skills } from "../../live/store";
import { change, settings } from "../../store";
import { MODES, type Mode } from "../../store/settings";
import { ClassMark, classOf } from "../../ui/classes";
import { clock, full, short } from "../../ui/format";
import { label, length, partyDps } from "./logic";
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
          <For each={fight.rows}>
            {(r, i) => (
              <button
                class="board-row"
                aria-pressed={r.id === row()?.id}
                onClick={() => setPicked(r.id)}
                style={{ "--class": classOf(r.job).color, "--length": length(r, fight.rows) }}
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
        <Show when={row()}>
          {(r) => (
            <section class="block">
              <h2>{label(r(), settings.meter.hideNames, fight.rows.indexOf(r()) + 1)}</h2>
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
