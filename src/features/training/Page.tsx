import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { runOver } from "./logic";
import { SHOWN, verdicts } from "./verdicts";
import { Grade } from "../best/Grade";
import { engineSend } from "../../api";
import { fight, live, skills } from "../../live/store";
import { change, settings } from "../../store";
import { clock, day, short, time } from "../../ui/format";
import { RunLength } from "../../ui/RunLength";
import { Waiting } from "../../ui/Waiting";
import { Skills } from "../meter/Skills";
import { bestOf, bests } from "../history/logic";
import { allGrades, fights, followFights } from "../history/store";
import "../meter/meter.css";
import "../meter/page.css";

const seconds = () => settings.training.seconds;

/** Names and groups you gave runs, by fight. On this PC. */
const KEY = "training-runs";
type Named = Record<string, { name: string; group: string }>;
const readNamed = (): Named => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Named;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};
const [named, setNamed] = createSignal<Named>(readNamed());
addEventListener("storage", (e) => e.key === KEY && setNamed(readNamed()));
const nameRun = (id: string, to: Partial<Named[string]>) => {
  const was = named()[id] ?? { name: "", group: "" };
  const next = { ...named(), [id]: { name: (to.name ?? was.name).trim().slice(0, 60), group: (to.group ?? was.group).trim().slice(0, 40) } };
  setNamed(next);
  localStorage.setItem(KEY, JSON.stringify(next));
};

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
  const [group, setGroup] = createSignal("");
  const groups = createMemo(() => [...new Set(Object.values(named()).map((n) => n.group).filter(Boolean))].sort());
  const goal = () => settings.training.goal;
  const runs = createMemo(() => fights().filter((f) => f.dummy && f.you && (!group() || named()[f.id]?.group === group())));
  const best = createMemo(() => bests(runs()));
  const listed = createMemo(() => runs().slice(0, SHOWN));
  const verdict = verdicts(listed);

  return (
    <div class="page">
      <header class="page-head">
        <h1>Training dummy</h1>
        <RunLength after={begin} />
        <label class="ui-row">
          <small class="ui-muted">Goal a second</small>
          <input class="ui-input ui-num goal-input" type="number" min="0" step="1000" aria-label="Damage a second to reach" value={goal() || ""} placeholder="None"
            onChange={(e) => change((s) => (s.training.goal = Math.max(0, Math.round(e.currentTarget.valueAsNumber || 0))))} />
        </label>
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
          <Show when={goal()}>
            <div class="stat" data-goal={(you()?.dps ?? 0) >= goal() || undefined}>
              <small>{(you()?.dps ?? 0) >= goal() ? "Goal reached" : "To the goal"}</small>
              <b class="ui-num">{(you()?.dps ?? 0) >= goal() ? short(goal()) : short(goal() - (you()?.dps ?? 0))}</b>
            </div>
          </Show>
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
      <Show when={runs().length || group()}>
        <section class="block">
          <h2>Runs before</h2>
          <Show when={groups().length || group()}>
            <div class="ui-row" role="group" aria-label="Group">
              <button class="ui-chip" aria-pressed={!group()} onClick={() => setGroup("")}>Every run</button>
              <For each={groups()}>{(g) => <button class="ui-chip" aria-pressed={group() === g} onClick={() => setGroup(g)}>{g}</button>}</For>
            </div>
          </Show>
          <datalist id="run-groups"><For each={groups()}>{(g) => <option value={g} />}</For></datalist>
          <p class="ui-muted ui-small">Open one in History to compare two runs: what was luck, what was a real gain.</p>
          <For each={listed()}>
            {(f) => (
              <div class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) 130px 110px auto auto 90px" }}>
                <span>
                  {named()[f.id]?.name || f.target}{" "}
                  <Show when={bestOf(best(), f)?.id === f.id}>
                    <span class="ui-tag" style={{ "--tag": "var(--accent)" }}>Best</span>
                  </Show>{" "}
                  <Grade of={allGrades().get(f.id)} />{" "}
                  <Show when={verdict(f)}>
                    {(why) => (
                      <Show when={why().length} fallback={<span class="ui-tag" style={{ "--tag": "var(--tone-ready)" }}>Clean run</span>}>
                        <small class="ui-muted">{why().join(", ")}</small>
                      </Show>
                    )}
                  </Show>
                </span>
                <input class="ui-input" aria-label={`Name of the run at ${time(f.start)}`} placeholder="Name" maxLength={60} value={named()[f.id]?.name ?? ""} onChange={(e) => nameRun(f.id, { name: e.currentTarget.value })} />
                <input class="ui-input" list="run-groups" aria-label={`Group of the run at ${time(f.start)}`} placeholder="Group" maxLength={40} value={named()[f.id]?.group ?? ""} onChange={(e) => nameRun(f.id, { group: e.currentTarget.value })} />
                <span class="ui-muted">{day(f.start)}, {time(f.start)}</span>
                <span class="ui-muted ui-num">{clock(f.ms)}</span>
                <span class="ui-share" data-goal={(goal() && (f.you?.dps ?? 0) >= goal()) || undefined} style={{ "--share": (f.you?.dps ?? 0) / Math.max(1, goal(), ...runs().map((r) => r.you?.dps ?? 0)) }}>{short(f.you?.dps ?? 0)}</span>
              </div>
            )}
          </For>
        </section>
      </Show>
    </div>
  );
}
