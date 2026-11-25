import { createEffect, createMemo, createResource, createSignal, For, on, Show } from "solid-js";
import { fight as loadFight } from "../../api";
import { near } from "../../live/store";
import type { Saved } from "../../live/types";
import { change, settings } from "../../store";
import { plan, type BossPlan, type Mechanic } from "../../store/settings";
import { CLASSES } from "../../ui/classes";
import { clock, full, short } from "../../ui/format";
import { Line } from "../../ui/Line";
import { Switch } from "../../ui/Switch";
import { fights, followFights } from "../history/store";
import { bossEffects } from "../alerts/logic";
import { Voice } from "../alerts/Voice";
import { hitBy, key, learn, seconds, trend } from "./logic";
import "../history/history.css";
import "./bosses.css";

/** Pulls that are read for one boss, the newest. */
const READ = 20;

/** What you set for each boss, and what your own pulls teach about it. */
export function BossesPage() {
  followFights();
  const list = createMemo(() => {
    const all = new Map<string, Saved[]>();
    for (const f of fights()) if (!f.dummy) all.set(key(f), [...(all.get(key(f)) ?? []), f]);
    return [...all].map(([id, pulls]) => ({ id, pulls, name: pulls[0].target }));
  });
  const [picked, setPicked] = createSignal<string>();
  const open = createMemo(() => list().find((b) => b.id === picked()) ?? list()[0]);
  return (
    <div class="page history">
      <header class="page-head">
        <h1>Bosses</h1>
      </header>
      <Show
        when={list().length}
        fallback={
          <div class="ui-empty">
            <span class="ui-icon" aria-hidden="true">{""}</span>
            <p>Bosses you fought are listed here. Set their enrage, health marks and timers, and mark hits you could have avoided.</p>
          </div>
        }
      >
        <div class="history-panes">
          <div class="history-list">
            <For each={list()}>
              {(b) => (
                <button class="ui-row-item history-item" aria-selected={b.id === open()?.id} onClick={() => setPicked(b.id)}>
                  <span class="history-name">{b.name}</span>
                  <b class="ui-num">{b.pulls.length}</b>
                  <small class="ui-muted ui-num">{b.pulls.filter((p) => p.killed).length} killed, best {short(Math.max(...b.pulls.map((p) => p.you?.dps ?? 0)))}</small>
                </button>
              )}
            </For>
          </div>
          <Show when={open()?.id} keyed>
            {(id) => <Boss id={id} pulls={list().find((b) => b.id === id)!.pulls} />}
          </Show>
        </div>
      </Show>
    </div>
  );
}

function Boss(props: { id: string; pulls: Saved[] }) {
  const ids = createMemo(() => props.pulls.slice(0, READ).map((p) => p.id).join(" "));
  const [read] = createResource(ids, async (list) => (await Promise.all(list.split(" ").map(loadFight))).filter((f): f is Saved => !!f));
  const pulls = () => read() ?? [];
  const set = createMemo(() => plan(settings.bosses[props.id]));
  const edit = (change_: (p: BossPlan) => void) =>
    change((s) => {
      const next = plan(s.bosses[props.id]);
      change_(next);
      s.bosses = { ...s.bosses, [props.id]: next };
    });
  const learned = createMemo(() => learn(pulls()));
  const hits = createMemo(() => hitBy(pulls()));
  const counts = createMemo(() => trend(pulls(), set().avoid));
  const timed = (skill: number) => set().timers.some((t) => t.skill === skill);
  // Timers you took stay listed, even once no pull shows them any more.
  const offers = createMemo(() => [
    ...learned(),
    ...set().timers.filter((t) => !learned().some((l) => l.skill === t.skill)).map((t) => ({ ...t, damage: 0, pulls: 0 })),
  ]);
  const [wrong, setWrong] = createSignal("");
  return (
    <section class="history-detail">
      <header class="page-head">
        <h2>{props.pulls[0].target}</h2>
      </header>
      <section class="block">
        <h2>On the boss bar</h2>
        <Line name="Enrage" about={wrong() === "enrage" ? "Write it as 6:30 or in seconds." : "The bar shows whether you are in time."} bad={wrong() === "enrage"}>
          <Entry
            name="Enrage, minutes and seconds"
            value={set().enrage ? clock(set().enrage * 1000) : ""}
            hint="6:30"
            set={(text) => {
              const time = text ? seconds(text) : 0;
              setWrong(time === undefined ? "enrage" : "");
              if (time !== undefined) edit((p) => (p.enrage = time));
            }}
          />
        </Line>
        <Line name="Health marks" about={wrong() === "marks" ? "Write percents from 1 to 99, like 75, 50, 25." : "Reports split the fight here too."} bad={wrong() === "marks"}>
          <Entry
            name="Health marks in percent"
            value={set().marks.join(", ")}
            hint="75, 50, 25"
            set={(text) => {
              const marks = text.split(/[\s,;%]+/).filter(Boolean).map(Number);
              const fine = marks.every((m) => Number.isFinite(m) && m >= 1 && m <= 99);
              setWrong(fine ? "" : "marks");
              if (fine) edit((p) => (p.marks = marks));
            }}
          />
        </Line>
      </section>
      <section class="block">
        <h2>Notes</h2>
        <Notes value={set().notes} set={(text) => edit((p) => (p.notes = text))} />
        <p class="ui-muted ui-small">Shown in the Callouts overlay as the fight begins.</p>
      </section>
      <Mechanics
        all={set().mechanics}
        offers={[
          ...hits().map((h) => ({ id: h.skill, name: h.name, effect: false })),
          ...learned().map((t) => ({ id: t.skill, name: t.name, effect: false })),
          ...[...bossEffects(pulls()), ...(near.target?.boss && near.target.name === props.pulls[0].target ? near.target.auras.filter((a) => !a.yours) : [])].map((e) => ({ id: e.id, name: e.name, effect: true })),
        ]}
        set={(all) => edit((p) => (p.mechanics = all))}
      />
      <Voice />
      <section class="block">
        <h2>Timers from your pulls</h2>
        <For each={offers()} fallback={<p class="ui-muted">A hit that comes at the same time in two or more pulls is offered here.</p>}>
          {(t) => (
            <Switch
              name={t.name}
              about={`${t.at.map((s) => clock(s * 1000)).slice(0, 10).join(", ")}${t.pulls ? `. About ${full(t.damage)} each, seen in ${t.pulls} pulls` : ""}`}
              on={timed(t.skill)}
              set={(on) =>
                edit((p) => {
                  p.timers = p.timers.filter((x) => x.skill !== t.skill);
                  if (on) p.timers.push({ skill: t.skill, name: t.name, at: [...t.at] });
                })
              }
            />
          )}
        </For>
      </section>
      <section class="block">
        <h2>What hit you in your last {Math.min(READ, props.pulls.length)} pulls</h2>
        <Show when={set().avoid.length && counts().length > 1}>
          <p class="trend" role="img" aria-label={`Avoidable hits by pull, oldest first: ${counts().join(", ")}`}>
            <For each={counts()}>{(n) => <i data-tip={String(n)} style={{ "--part": n / Math.max(1, ...counts()) }} />}</For>
            <span class="ui-muted">avoidable hits by pull, oldest first</span>
          </p>
        </Show>
        <For each={hits()} fallback={<p class="ui-muted">Nothing yet.</p>}>
          {(h) => (
            <label class="ui-row-item ui-check-row" style={{ "--columns": "auto minmax(0, 1fr) 120px 110px", display: "grid" }}>
              <input
                type="checkbox"
                class="ui-check"
                aria-label={`${h.name} could have been avoided`}
                checked={set().avoid.includes(h.skill)}
                onChange={(e) => {
                  const on = e.currentTarget.checked;
                  edit((p) => (p.avoid = on ? [...p.avoid, h.skill] : p.avoid.filter((s) => s !== h.skill)));
                }}
              />
              <span>{h.name}</span>
              <span class="ui-muted ui-num">{h.hits} hits, {h.last} last</span>
              <span class="ui-share" style={{ "--share": h.damage / Math.max(1, hits()[0].damage) }}>{short(h.damage)}</span>
            </label>
          )}
        </For>
        <Show when={hits().length}>
          <p class="ui-muted ui-small">Tick what you could have avoided. Reports then count it.</p>
        </Show>
      </section>
    </section>
  );
}

function Entry(props: { name: string; value: string; hint: string; set: (text: string) => void }) {
  let input!: HTMLInputElement;
  createEffect(on(() => props.value, (v) => (input.value = v)));
  return <input ref={input} class="ui-input boss-entry" aria-label={props.name} placeholder={props.hint} onChange={(e) => props.set(e.currentTarget.value.trim())} />;
}

function Notes(props: { value: string; set: (text: string) => void }) {
  let area!: HTMLTextAreaElement;
  createEffect(on(() => props.value, (v) => (area.value = v)));
  return <textarea ref={area} class="ui-input boss-notes" aria-label="Notes" maxlength={2000} placeholder="Stack at the pillar." onChange={(e) => props.set(e.currentTarget.value.trim())} />;
}

type Offer = Pick<Mechanic, "id" | "name" | "effect">;

/** Your own word about each thing it does, said as it lands. */
function Mechanics(props: { all: Mechanic[]; offers: Offer[]; set: (all: Mechanic[]) => void }) {
  const of = (o: Offer) => `${o.effect} ${o.name || o.id}`;
  const left = createMemo(() => {
    const known = new Set(props.all.map(of));
    const unique = new Map(props.offers.map((o) => [of(o), o]));
    return [...unique].filter(([k]) => !known.has(k)).map(([, o]) => o);
  });
  const edit = (at: number, to: Partial<Mechanic>) => props.set(props.all.map((m, i) => (i === at ? { ...m, ...to } : { ...m })));
  return (
    <section class="block">
      <h2>Mechanics</h2>
      <For each={props.all}>
        {(m, i) => (
          <div class="mechanic">
            <span>{m.name || (m.effect ? `Effect ${m.id}` : `Skill ${m.id}`)}<Show when={m.effect}> <small class="ui-muted">effect</small></Show></span>
            <Entry name={`Note for ${m.name}`} value={m.note} hint="What to do" set={(note) => edit(i(), { note })} />
            <select class="ui-select" aria-label={`Class ${m.name} is for`} value={m.job} onChange={(e) => edit(i(), { job: e.currentTarget.value as Mechanic["job"] })}>
              <option value="">Every class</option>
              <For each={Object.entries(CLASSES)}>{([job, c]) => <option value={job}>{c.name}</option>}</For>
            </select>
            <button class="ui-chip" aria-pressed={m.say} onClick={() => edit(i(), { say: !m.say })}>Say it</button>
            <button class="ui-icon-button" aria-label={`Remove ${m.name}`} onClick={() => props.set(props.all.filter((_, n) => n !== i()))}>{"\ue711"}</button>
          </div>
        )}
      </For>
      <Line name="Add one" about={left().length ? "What hit you in your pulls, and what it had on itself this session." : "Nothing more was seen yet."}>
        <select
          class="ui-select aura-pick"
          aria-label="Add a mechanic"
          value=""
          disabled={!left().length}
          onChange={(e) => {
            const found = left().find((o) => of(o) === e.currentTarget.value);
            e.currentTarget.value = "";
            if (found) props.set([...props.all, { ...found, note: "", job: "", say: false }]);
          }}
        >
          <option value="">Choose</option>
          <For each={left()}>{(o) => <option value={of(o)}>{o.name || o.id}{o.effect ? ", effect" : ""}</option>}</For>
        </select>
      </Line>
      <p class="ui-muted ui-small">A skill is known as its first hit lands, so a word ahead of it needs a timer from the list below. The boss's own lines on screen are not read.</p>
    </section>
  );
}
