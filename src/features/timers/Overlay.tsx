import { createMemo, For } from "solid-js";
import { fight, sampling } from "../../live/store";
import { settings } from "../../store";
import { plan } from "../../store/settings";
import { key, upcoming } from "../bosses/logic";
import "../meter/meter.css";
import "./timers.css";

const AHEAD = 30_000;

/** The hits you chose for this boss that come within half a minute. */
export const soon = () => {
  if (!fight.rows.length || !fight.target.boss) return [];
  return upcoming(plan(settings.bosses[key({ code: fight.target.code, target: fight.target.name })]).timers, fight.ms, AHEAD).slice(0, 5);
};

export function TimersOverlay() {
  const list = createMemo(soon);
  return (
    <section class="timers glass" aria-label="Boss timers">
      {/* A sample countdown only to place it by. In play, nothing counts down when no timer runs. */}
      <For each={list()} fallback={<div class="timer"><span>Boss timers</span>{sampling() ? <b class="ui-num">0:12</b> : <small>None soon</small>}</div>}>
        {(t) => (
          <div class="timer" data-near={t.in < settings.voice.lead * 1000 || undefined} style={{ "--length": Math.max(0, Math.min(1, t.in / AHEAD)) }}>
            <i />
            <span>{t.name}</span>
            <b class="ui-num">{t.in < 10_000 ? (Math.max(0, t.in) / 1000).toFixed(1) : Math.ceil(t.in / 1000)}</b>
          </div>
        )}
      </For>
    </section>
  );
}
