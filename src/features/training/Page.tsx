import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { runOver } from "./logic";
import { engineSend } from "../../api";
import { fight, live, skills } from "../../live/store";
import { settings } from "../../store";
import { clock, day, short, time } from "../../ui/format";
import { Waiting } from "../../ui/Waiting";
import { Skills } from "../meter/Skills";
import { bestOf, bests } from "../history/logic";
import { fights, followFights } from "../history/store";
import "../meter/meter.css";
import "../meter/page.css";

const LENGTHS: [number, string][] = [[30, "30 s"], [60, "1 min"], [120, "2 min"], [180, "3 min"], [300, "5 min"], [0, "No limit"]];
const [seconds, setSeconds] = createSignal(60);

/** A timed run on a dummy. Only your own damage counts, from your first hit. */
export function TrainingPage() {
  followFights();
  const send = (command: { cmd: string } & Record<string, unknown>) => void engineSend(command).catch(console.error);
  const prepare = () => {
    send({ cmd: "mode", mode: "trainTargets" });
    send({ cmd: "limit", ms: seconds() * 1000 });
  };
  const begin = () => {
    prepare();
    send({ cmd: "reset" });
  };
  prepare();
  // Back to what the meter shows, and a fight with no limit.
  onCleanup(() => {
    send({ cmd: "limit", ms: 0 });
    send({ cmd: "mode", mode: settings.mode });
    send({ cmd: "watch", id: null });
  });

  const you = () => fight.rows.find((r) => r.you) ?? fight.rows[0];
  const watched = createMemo(() => you()?.id);
  createEffect(() => send({ cmd: "watch", id: watched() ?? null }));
  // A run ends when its time is up, or by itself when you stop hitting.
  const [hitAt, setHitAt] = createSignal(0);
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 500);
  onCleanup(() => clearInterval(timer));
  createEffect(() => {
    if (you()?.damage) setHitAt(Date.now());
  });
  const over = () => fight.timeup || (!!you()?.damage && runOver(hitAt(), now()));
  const length = () => seconds() * 1000;
  const left = () => Math.max(0, length() - fight.ms);
  const runs = createMemo(() => fights().filter((f) => f.dummy && f.you));
  const best = createMemo(() => bests(runs()));

  return (
    <div class="page">
      <header class="page-head">
        <h1>Training dummy</h1>
        <div class="ui-row" role="radiogroup" aria-label="Length">
          <For each={LENGTHS}>
            {([s, name]) => (
              <button class="ui-chip" role="radio" aria-checked={seconds() === s} onClick={() => { setSeconds(s); begin(); }}>{name}</button>
            )}
          </For>
        </div>
        <button class="ui-button" data-main onClick={begin}>
          <span class="ui-icon" aria-hidden="true">{""}</span>
          New run
        </button>
      </header>
      <Show when={fight.rows.length && live()} fallback={<Waiting idle="Hit a training dummy. The clock starts with your first hit." />}>
        <div class="stats">
          <div class="stat" data-hero>
            <small>{over() ? "Result, a second" : "Damage a second"}</small>
            <b class="ui-num">{short(you()?.dps ?? 0)}</b>
          </div>
          <div class="stat">
            <small>Damage</small>
            <b class="ui-num">{short(you()?.damage ?? 0)}</b>
          </div>
          <div class="stat">
            <small>{fight.timeup ? "Time is up" : over() ? "Ended at" : seconds() ? "Time left" : "Time"}</small>
            <b class="ui-num">{clock(seconds() && (fight.timeup || !over()) ? left() : fight.ms)}</b>
          </div>
        </div>
        <Show when={seconds()}>
          <div class="ui-meter run-left" data-state={over() ? "done" : undefined}>
            <i style={{ "--value": fight.timeup ? 1 : Math.min(1, fight.ms / length()) }} />
          </div>
        </Show>
        <Show when={you() && skills().id === you()!.id}>
          <section class="block">
            <h2>Skills</h2>
            <Skills skills={skills().skills} job={you()!.job} />
          </section>
        </Show>
      </Show>
      <Show when={runs().length}>
        <section class="block">
          <h2>Runs before</h2>
          <p class="ui-muted ui-small">Open one in History to compare two runs: what was luck, what was a real gain.</p>
          <For each={runs().slice(0, 20)}>
            {(f) => (
              <div class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) auto auto 90px" }}>
                <span>
                  {f.target}{" "}
                  <Show when={bestOf(best(), f)?.id === f.id}>
                    <span class="ui-tag" style={{ "--tag": "var(--accent)" }}>Best</span>
                  </Show>
                </span>
                <span class="ui-muted">{day(f.start)}, {time(f.start)}</span>
                <span class="ui-muted ui-num">{clock(f.ms)}</span>
                <span class="ui-share" style={{ "--share": (f.you?.dps ?? 0) / Math.max(1, ...runs().map((r) => r.you?.dps ?? 0)) }}>{short(f.you?.dps ?? 0)}</span>
              </div>
            )}
          </For>
        </section>
      </Show>
    </div>
  );
}
