import { createEffect, createMemo, createResource, createSignal, For, Match, on, onCleanup, Show, Switch } from "solid-js";
import { deleteFight, exportFile, fight as loadFight, keptFight } from "../../api";
import { NAME } from "../../app/brand";
import type { Buff, FightRow, Saved } from "../../live/types";
import { hideNames, settings } from "../../store";
import { plan } from "../../store/settings";
import { ClassMark, classOf } from "../../ui/classes";
import { clock, full, percent, short } from "../../ui/format";
import { Drawn } from "../../ui/icons";
import { Choices } from "../../ui/Line";
import { Pic } from "../../ui/Pic";
import { key } from "../bosses/logic";
import { Chart } from "../history/Chart";
import { path } from "../history/logic";
import { forgetFight } from "../history/store";
import { label, length } from "../meter/logic";
import { Skills } from "../meter/Skills";
import { figures, luck, skillGains, statChanges, type Figure } from "./compare";
import { buffsBySkill, mvp, opening, overheal, partyCurve, pings, players, rates, titles, unclean, type Mvp } from "./deep";
import { Lanes, type Lane } from "./Lanes";
import { activeDps, casts, chains, findings, gaps, nameOf, opener, parts, procs, resultText, rhythm, starts, untouchable, waited, wipeLine } from "./logic";
import { bytes, fileName, picture } from "./share";
import "../meter/meter.css";
import "../meter/page.css";
import "./report.css";

const TABS = [["all", "Overview"], ["casts", "Rotation"], ["buffs", "Buffs"], ["taken", "Taken"], ["heals", "Healing"], ["stagger", "Stagger"], ["compare", "Compare"], ["play", "Play back"]] as const;
type Tab = (typeof TABS)[number][0];
const [tab, setTab] = createSignal<Tab>("all");

/** Two fights ticked in the list. */
export function Pair(props: { older: Saved; newer: Saved }) {
  const [whole] = createResource(() => props.newer.id, loadFight);
  const ready = () => (whole()?.id === props.newer.id ? whole()! : undefined);
  return (
    <section class="history-detail">
      <header class="page-head">
        <h2>{props.newer.target === props.older.target ? props.newer.target : `${props.newer.target} against ${props.older.target}`}</h2>
      </header>
      <Show when={ready()}>{(f) => <Compare fight={f()} others={[props.older]} />}</Show>
    </section>
  );
}

/** One fight, in full. `others` are fights of the same kind, to compare with. */
export function Report(props: { fight: Saved; best?: Saved; others: Saved[] }) {
  const [whole] = createResource(() => props.fight.id, loadFight);
  const [behind] = createResource(() => (props.best && props.best.id !== props.fight.id ? props.best.id : undefined), loadFight);
  // While another fight loads, the one before is still there.
  const ready = () => (whole()?.id === props.fight.id ? whole()! : undefined);
  const best = () => (behind()?.id === props.best?.id ? (behind() ?? undefined) : undefined);
  const has: Record<Tab, (f: Saved) => boolean> = {
    all: () => true,
    casts: (f) => !!f.casts?.length,
    buffs: (f) => !!f.buffs?.length,
    taken: (f) => !!f.taken?.length || !!f.deaths?.length,
    heals: (f) => !!(f.rows ?? [f.you]).some((r) => r?.healing),
    stagger: (f) => !!f.stagger?.length,
    compare: () => props.others.length > 0,
    play: (f) => (f.curve?.length ?? 0) > 1,
  };
  const tabs = createMemo(() => TABS.filter(([id]) => ready() && has[id](ready()!)));
  const shown = () => (tabs().some(([id]) => id === tab()) ? tab() : "all");

  return (
    <section class="history-detail">
      <header class="page-head">
        <h2>{props.fight.target}</h2>
        <Share fight={props.fight} whole={ready()} />
      </header>
      <Show when={ready()}>
        {(f) => (
          <>
            <div class="report-tabs">
              <Choices name="Part of the report" all={tabs()} value={shown()} set={setTab} />
            </div>
            <Switch>
              <Match when={shown() === "all"}><Overview fight={f()} best={best()} /></Match>
              <Match when={shown() === "casts"}><Rotation fight={f()} best={best()} /></Match>
              <Match when={shown() === "buffs"}><Buffs fight={f()} /></Match>
              <Match when={shown() === "taken"}><Taken fight={f()} /></Match>
              <Match when={shown() === "heals"}><Heals fight={f()} /></Match>
              <Match when={shown() === "stagger"}><Stagger fight={f()} /></Match>
              <Match when={shown() === "compare"}><Compare fight={f()} others={props.others} best={props.best} /></Match>
              <Match when={shown() === "play"}><Play fight={f()} /></Match>
            </Switch>
          </>
        )}
      </Show>
    </section>
  );
}

const rowsOf = (f: Saved): FightRow[] => f.rows ?? (f.you ? [f.you] : []);
/** A player's name as the settings show it. Nobody is named in a fight from before. */
function who(f: Saved, id: number): string {
  const at = rowsOf(f).findIndex((r) => r.id === id);
  if (at >= 0) return label(rowsOf(f)[at], hideNames(), at + 1);
  return id === 0 ? "Someone else" : f.target;
}

function Share(props: { fight: Saved; whole?: Saved }) {
  const [done, setDone] = createSignal("");
  let timer = 0;
  onCleanup(() => clearTimeout(timer));
  const run = (work: () => Promise<unknown>, said: string) => () => {
    clearTimeout(timer);
    void work()
      .then(() => setDone(said), (e) => setDone(`That did not work: ${String(e)}`))
      .then(() => (timer = window.setTimeout(() => setDone(""), 4_000)));
  };
  const whole = () => props.whole ?? props.fight;
  return (
    <>
      <span class="ui-muted ui-small" role="status">{done()}</span>
      <button class="ui-icon-button" aria-label="Copy your result" onClick={run(() => navigator.clipboard.writeText(resultText(whole())), "Copied.")}>{""}</button>
      <button
        class="ui-icon-button"
        aria-label="Save a picture, other names hidden"
        onClick={run(async () => exportFile(`${fileName(props.fight)}.png`, await picture(whole(), (job) => classOf(job as FightRow["job"]).color)), "Saved in Downloads.")}
      >
        {""}
      </button>
      <button
        class="ui-icon-button"
        aria-label="Save your part as JSON"
        onClick={run(async () => exportFile(`${fileName(props.fight)}.json`, bytes(JSON.stringify(await keptFight(props.fight.id), null, 1))), "Saved in Downloads.")}
      >
        {""}
      </button>
      <button
        class="ui-icon-button"
        aria-label="Delete this fight"
        onClick={() => void deleteFight(props.fight.id).then(() => forgetFight(props.fight.id)).catch(console.error)}
      >
        {""}
      </button>
    </>
  );
}

function Stat(props: { name: string; value: string; tip?: string; hero?: boolean }) {
  return (
    <div class="stat" data-hero={props.hero || undefined}>
      <small>{props.name}</small>
      <b class="ui-num" data-tip={props.tip}>{props.value}</b>
    </div>
  );
}

function buffLanes(f: Saved, list: Buff[], note: (b: Buff) => string, color: string): Lane[] {
  return list.map((b) => ({
    name: b.name || `Buff ${b.id}`,
    of: { effect: b.id, skill: b.skill },
    note: note(b),
    color,
    marks: (b.passive ? [[0, f.ms, 1] as const] : b.spans).map(([from, to, stacks]) => ({
      from, to, tip: `${clock(Math.max(0, from))} to ${clock(to)}${stacks > 1 ? `, ${stacks} stacks` : ""}`, weight: b.passive ? 0.35 : undefined,
    })),
  }));
}
const up = (f: Saved, b: Buff) => percent(b.up, f.ms);
/** Yours that come and go, those that are on and off the most first. */
const ownBuffs = (f: Saved) =>
  (f.buffs ?? []).filter((b) => !b.passive && (b.on === f.you?.id || b.by === f.you?.id)).sort((a, b) => Math.abs(a.up / f.ms - 0.5) - Math.abs(b.up / f.ms - 0.5));

const mvpWords = (m: Mvp) =>
  [["damage with buffs", m.damage], ["healing", m.healing], ["stagger", m.stagger], ["deaths", -m.deaths]]
    .filter(([, points]) => Math.round(points as number) !== 0)
    .map(([name, points]) => `${name} ${Math.round(points as number)}`)
    .join(", ") + ` points`;

function Overview(props: { fight: Saved; best?: Saved }) {
  const [picked, setPicked] = createSignal<number>();
  createEffect(on(() => props.fight.id, () => setPicked(undefined)));
  const rows = () => rowsOf(props.fight);
  const row = () => rows().find((r) => r.id === picked()) ?? rows().find((r) => r.you) ?? rows()[0];
  const set = () => plan(settings.bosses[key(props.fight)]);
  const list = createMemo(() => findings(props.fight, props.best, set().avoid).slice(0, 8));
  const cut = createMemo(() => parts(props.fight, set().marks.length ? set().marks : [75, 50, 25]));
  const off = createMemo(() => untouchable(props.fight).reduce((sum, s) => sum + s.to - s.from, 0));
  const you = () => props.fight.you;
  const why = createMemo(() => unclean(props.fight));
  const trip = createMemo(() => pings(props.fight));
  const top = createMemo(() => mvp(props.fight));
  const named = createMemo(() => titles(props.fight));
  const credited = () => (you()?.damage ?? 0) - (you()?.got ?? 0) + (you()?.given ?? 0);
  return (
    <>
      <div class="stats">
        <Stat hero name="You, a second" value={short(you()?.dps ?? 0)} />
        <Stat name="Your damage" value={short(you()?.damage ?? 0)} tip={full(you()?.damage ?? 0)} />
        <Show when={you()?.given || you()?.got}>
          <Stat name="With buffs counted" value={short(credited() / Math.max(1, props.fight.ms / 1000))} tip={`Your buffs gave ${full(you()!.given ?? 0)}, others' gave you ${full(you()!.got ?? 0)}. An estimate.`} />
        </Show>
        <Show when={off() > 0}>
          <Stat name="While it could be hit" value={short(activeDps(props.fight))} tip={`Without ${clock(off())} in which nobody could hit it`} />
        </Show>
        <Stat name={`Your share of ${props.fight.players}`} value={percent(you()?.damage ?? 0, props.fight.total)} />
        <Stat name="Time" value={clock(props.fight.ms)} />
      </div>
      <Show when={props.fight.dummy && props.fight.casts?.length}>
        <p class="report-line">
          <Show when={why().length} fallback={<><span class="ui-tag" style={{ "--tag": "var(--tone-ready)" }}>Clean run</span> Nothing was off: no pause, nobody else, no buff from others.</>}>
            Not a clean run: {why().join(", and ")}.
          </Show>
        </p>
      </Show>
      <Show when={wipeLine(props.fight, (id) => who(props.fight, id))}>{(line) => <p class="report-line">{line()}</p>}</Show>
      <Show when={(props.fight.lost ?? 0) > props.fight.total}>
        <p class="report-line">It lost {short(props.fight.lost!)} health, so players you could not see did about {short(props.fight.lost! - props.fight.total)} of it.</p>
      </Show>
      <Show when={list().length}>
        <section class="block">
          <h2>What to do better</h2>
          <ul class="findings">
            <For each={list()}>{(f) => <li style={{ "--cost": Math.min(1, f.cost * 8) }}>{f.text}</li>}</For>
          </ul>
        </section>
      </Show>
      <Chart curve={props.fight.curve ?? []} best={props.best?.curve} party={partyCurve(props.fight)} deaths={(props.fight.deaths ?? []).map((d) => ({ ms: d.ms, you: d.you, who: who(props.fight, d.id) }))} />
      <Show when={trip()}>
        {(p) => (
          <figure class="pings">
            <svg class="wave" viewBox="0 0 600 34" preserveAspectRatio="none" role="img" aria-label="Ping over the fight">
              <path d={`${path(p().line, 600, 34, p().most * 1.1, p().line.length)}V34H0Z`} />
            </svg>
            <figcaption class="ui-num">Ping {p().average} ms, {p().least} to {p().most}</figcaption>
          </figure>
        )}
      </Show>
      <Show when={ownBuffs(props.fight).length}>
        <Lanes label="Buffs under the chart" ms={props.fight.ms} axis={false} lanes={buffLanes(props.fight, ownBuffs(props.fight).slice(0, 6), (b) => up(props.fight, b), "var(--accent)")} />
      </Show>
      <Show when={cut().length}>
        <section class="block">
          <h2>By the target's health</h2>
          <For each={cut()}>
            {(p) => (
              <div class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) 110px 110px" }}>
                <span>{p.name}</span>
                <span class="ui-muted ui-num">{clock(p.to - p.from)}</span>
                <span class="ui-share" style={{ "--share": p.dps / Math.max(1, ...cut().map((c) => c.dps)) }}>{short(p.dps)}</span>
              </div>
            )}
          </For>
        </section>
      </Show>
      <Show when={props.fight.rows}>
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
                <span class="meter-name">
                  <span>{label(r, hideNames(), i() + 1)}</span>
                  <Show when={top()?.id === r.id}>
                    <span class="mvp" data-tip={mvpWords(top()!)}><Drawn name="crown" /><b>MVP</b></span>
                  </Show>
                  <Show when={named().get(r.id)}>{(t) => <small class="board-title">{t()}</small>}</Show>
                </span>
                <small class="ui-num">{short(r.damage)}</small>
                <small class="ui-num">{r.share.toFixed(1)}%</small>
                <b class="ui-num">{short(r.dps)}</b>
              </button>
            )}
          </For>
        </div>
        <Show when={rows().length > 1}>
          <section class="block by-skill players ui-num" role="table" aria-label="Players" style={{ "--columns": 6 }}>
            <div role="row" class="ui-muted ui-small">
              <span role="columnheader">A second</span>
              <For each={[["Damage", "As it was"], ["rDPS", "With what their buffs gave others"], ["nDPS", "Without what others' buffs gave them"], ["Healing", ""], ["Overheal", "The part of it that was too much, about"], ["Support", "How long their passing buffs were on others, added up"]]}>
                {([name, tip]) => <span role="columnheader" data-tip={tip || undefined}>{name}</span>}
              </For>
            </div>
            <For each={players(props.fight)}>
              {(p) => (
                <div role="row">
                  <span role="rowheader">{who(props.fight, p.id)}</span>
                  <span role="cell">{short(p.dps)}</span>
                  <span role="cell">{short(p.rdps)}</span>
                  <span role="cell">{short(p.ndps)}</span>
                  <span role="cell">{p.hps ? short(p.hps) : ""}</span>
                  <span role="cell">{p.over === undefined ? "" : percent(p.over, 1)}</span>
                  <span role="cell">{p.support ? clock(p.support) : ""}</span>
                </div>
              )}
            </For>
          </section>
        </Show>
        <p class="ui-muted ui-small">Other players are gone when {NAME} closes.</p>
      </Show>
      <Show when={rates(row()?.skills).length}>
        <div class="stats">
          <For each={rates(row()!.skills)}>{(r) => <Stat name={r.name} value={percent(r.share, 1)} tip={r.tip} />}</For>
          <Show when={row()!.hitsTaken}>{(n) => <Stat name="Blocked or parried" value={percent(row()!.blocked ?? 0, n())} tip={`${row()!.blocked ?? 0} of ${n()} hits taken`} />}</Show>
          <Show when={row()!.healing}>{(n) => <Stat name="Healing a second" value={short(n() / Math.max(1, props.fight.ms / 1000))} tip={full(n())} />}</Show>
          <Show when={row()!.power}>{(n) => <Stat name="Combat Power" value={full(n())} />}</Show>
        </div>
      </Show>
      <Show when={row()}>{(r) => <Skills skills={r().skills ?? []} job={r().job} />}</Show>
    </>
  );
}

const ZOOMS = [[1, "Whole fight"], [2, "2x"], [4, "4x"], [8, "8x"]] as const;

function Rotation(props: { fight: Saved; best?: Saved }) {
  const [zoom, setZoom] = createSignal<number>(1);
  const start = createMemo(() => opening(props.fight));
  const list = createMemo(() => casts(props.fight.casts));
  const waits = createMemo(() => new Map(waited(props.fight).map((w) => [w.skill, w])));
  const holes = createMemo(() => gaps(props.fight));
  const off = createMemo(() => untouchable(props.fight));
  const lanes = createMemo((): Lane[] => {
    const by = new Map<number, { damage: number; marks: Lane["marks"] }>();
    for (const c of list()) {
      const lane = by.get(c.skill) ?? { damage: 0, marks: [] };
      by.set(c.skill, lane);
      lane.damage += c.damage;
      lane.marks.push({ from: c.ms, to: c.end, tip: `${clock(c.ms)}, ${short(c.damage)}` });
    }
    const skills = [...by].sort((a, b) => b[1].damage - a[1].damage).slice(0, 16).map(([skill, lane]) => {
      const lost = waits().get(skill);
      return { name: nameOf(props.fight, skill), of: { skill }, note: `${lane.marks.length}${lost?.more ? `, ${lost.more} more fit` : ""}`, marks: lane.marks };
    });
    const extra: Lane[] = [];
    if (holes().length) extra.push({ name: "Nothing done", color: "var(--tone-danger)", note: clock(holes().reduce((s, g) => s + g.to - g.from, 0)), marks: holes().map((g) => ({ ...g, tip: `${clock(g.from)}, ${((g.to - g.from) / 1000).toFixed(1)} s` })) });
    if (off().length) extra.push({ name: "Could not be hit", color: "var(--text-muted)", marks: off() });
    return [...extra, ...skills];
  });
  const wave = createMemo(() => rhythm(props.fight));
  const most = () => Math.max(1, ...wave());
  const broken = createMemo(() => chains(props.fight));
  const gone = createMemo(() => procs(props.fight));
  const first = () => [opener(props.fight), props.best && props.best.id !== props.fight.id ? opener(props.best) : undefined] as const;
  return (
    <>
      <div class="stats">
        <Stat hero name="Casts a minute" value={(list().length / Math.max(1, props.fight.ms / 60_000)).toFixed(1)} />
        <Stat name="Time in gaps" value={clock(holes().reduce((s, g) => s + g.to - g.from, 0))} />
        <Show when={first()[0] !== undefined}>
          <Stat name="Your first 20 s" value={short(first()[0]! / 20)} />
        </Show>
        <Show when={first()[1]}>
          <Stat name="In your best pull" value={short(first()[1]! / 20)} />
        </Show>
      </div>
      <Show when={start().length > 1}>
        <section class="block">
          <h2>Opener</h2>
          <div class="opener" role="list">
            <For each={start()}>
              {(c) => (
                <span class="opener-cast" role="listitem" aria-label={`${nameOf(props.fight, c.skill)} at ${(c.ms / 1000).toFixed(1)} s`} data-tip={`${nameOf(props.fight, c.skill)}, ${short(c.damage)}`}>
                  <Pic skill={c.skill} name={nameOf(props.fight, c.skill)} large />
                  <small class="ui-num">{(c.ms / 1000).toFixed(1)}</small>
                </span>
              )}
            </For>
          </div>
        </section>
      </Show>
      <section class="block">
        <h2>Cast rhythm</h2>
        <svg class="wave" viewBox="0 0 600 56" preserveAspectRatio="none" role="img" aria-label="Casts a minute over the fight">
          <path d={`${path(wave(), 600, 56, most(), wave().length)}V56H0Z`} />
        </svg>
      </section>
      <div class="report-line"><Choices name="Zoom" all={ZOOMS} value={zoom()} set={setZoom} /></div>
      <Lanes label="When you used each skill" ms={props.fight.ms} lanes={lanes()} zoom={zoom()} />
      <Show when={waits().size}>
        <section class="block">
          <h2>Skills left waiting</h2>
          <For each={[...waits().values()].filter((w) => w.lost > 0)}>
            {(w) => (
              <div class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) 130px 130px 110px" }}>
                <span><Pic skill={w.skill} name={nameOf(props.fight, w.skill)} /> {nameOf(props.fight, w.skill)}</span>
                <span class="ui-muted ui-num">again after {clock(w.usual)}</span>
                <span class="ui-muted ui-num">waited {clock(w.lost)}</span>
                <span class="ui-num">{w.more ? `${w.more} more fit` : "used well"}</span>
              </div>
            )}
          </For>
          <p class="ui-muted ui-small">How soon a skill is ready again is taken from your own quickest casts of it, not from the game.</p>
        </section>
      </Show>
      <Show when={broken().length}>
        <section class="block">
          <h2>Follow-ups that did not come</h2>
          <For each={broken()}>
            {(c) => (
              <div class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) auto" }}>
                <span>{nameOf(props.fight, c.first)}, then {nameOf(props.fight, c.next)}</span>
                <span class="ui-muted ui-num">{c.broke.length} of {c.broke.length + c.kept}: {c.broke.slice(0, 4).map(clock).join(", ")}</span>
              </div>
            )}
          </For>
        </section>
      </Show>
      <Show when={gone().length}>
        <section class="block">
          <h2>Effects that went off by themselves</h2>
          <For each={gone().slice(0, 12)}>
            {(p) => (
              <div class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) 110px 110px" }}>
                <span><Pic effect={p.id} name={p.name || "Buff"} /> {p.name || `Buff ${p.id}`}</span>
                <span class="ui-muted ui-num">{p.times} times</span>
                <span class="ui-share" style={{ "--share": p.up / Math.max(1, props.fight.ms) }}>{percent(p.up, props.fight.ms)}</span>
              </div>
            )}
          </For>
        </section>
      </Show>
    </>
  );
}

function Buffs(props: { fight: Saved }) {
  const f = () => props.fight;
  const [on, setOn] = createSignal<number>();
  const targets = createMemo(() => {
    const ids = [...new Set((f().buffs ?? []).map((b) => b.on))];
    const rank = (id: number) => (id === f().you?.id ? -2 : rowsOf(f()).some((r) => r.id === id) ? 0 : -1);
    return ids.sort((a, b) => rank(a) - rank(b));
  });
  const at = () => (targets().includes(on()!) ? on()! : targets()[0]);
  const list = createMemo(() => (f().buffs ?? []).filter((b) => b.on === at()).sort((a, b) => Number(a.passive) - Number(b.passive) || b.up - a.up));
  const by = createMemo(() => buffsBySkill(f()));
  const from = (b: Buff) => (b.by === b.on ? "" : `, ${who(f(), b.by)}`);
  return (
    <>
      <Show when={f().credits?.length}>
        <section class="block">
          <h2>Damage that buffs added</h2>
          <For each={[...f().credits!].sort((a, b) => b.damage - a.damage).slice(0, 12)}>
            {(c) => (
              <div class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) minmax(0, 1fr) 110px" }}>
                <span><Pic effect={c.id} name={c.name || "Buff"} /> {c.name || `Buff ${c.id}`}</span>
                <span class="ui-muted">{who(f(), c.by)} to {who(f(), c.to)}</span>
                <span class="ui-share" style={{ "--share": c.damage / Math.max(1, ...f().credits!.map((x) => x.damage)) }}>{short(c.damage)}</span>
              </div>
            )}
          </For>
          <p class="ui-muted ui-small">Measured from this fight: the same skill with the buff on and off. The party's total stays the same. A buff that never came off cannot be measured.</p>
        </section>
      </Show>
      <div class="report-line">
        <Choices name="On whom" all={targets().slice(0, 12).map((id) => [id, who(f(), id)] as const)} value={at()} set={setOn} />
      </div>
      <Lanes
        label="Buffs over the fight"
        ms={f().ms}
        lanes={buffLanes(f(), list().slice(0, 40), (b) => `${up(f(), b)}${b.passive ? "" : ` in ${starts(b)}`}${from(b)}`, "var(--accent)")}
      />
      <Show when={by().rows.length}>
        <section class="block">
          <h2>Buffs by skill</h2>
          <div class="by-skill ui-num" role="table" aria-label="Share of each skill's casts that had each buff" style={{ "--columns": by().buffs.length }}>
            <div role="row">
              <span role="columnheader" class="ui-muted ui-small">Share of its casts</span>
              <For each={by().buffs}>
                {(b) => <span role="columnheader" aria-label={b.name || `Buff ${b.id}`} data-tip={`${b.name || `Buff ${b.id}`}${b.on === f().you?.id ? "" : `, on ${who(f(), b.on)}`}`}><Pic effect={b.id} skill={b.skill} name={b.name || "Buff"} /></span>}
              </For>
            </div>
            <For each={by().rows}>
              {(r) => (
                <div role="row">
                  <span role="rowheader"><Pic skill={r.skill} name={nameOf(f(), r.skill)} /> {nameOf(f(), r.skill)} <small class="ui-muted">{r.casts}</small></span>
                  <For each={r.shares}>{(s) => <span role="cell" data-share style={{ "--share": s }}>{percent(s, 1)}</span>}</For>
                </div>
              )}
            </For>
          </div>
          <p class="ui-muted ui-small">As each cast began. Buffs that were nearly always or never on are left out.</p>
        </section>
      </Show>
      <Show when={!f().rows}>
        <p class="ui-muted ui-small">Only buffs on you, yours on the target and the boss's own are kept after a session.</p>
      </Show>
    </>
  );
}

function Taken(props: { fight: Saved }) {
  const f = () => props.fight;
  const avoid = () => plan(settings.bosses[key(f())]).avoid;
  const skills = createMemo(() => {
    const by = new Map<number, { hits: number; damage: number; times: number[] }>();
    for (const [ms, skill, damage] of f().taken ?? []) {
      const s = by.get(skill) ?? { hits: 0, damage: 0, times: [] };
      by.set(skill, s);
      s.hits++;
      s.damage += damage;
      s.times.push(ms);
    }
    return [...by].sort((a, b) => b[1].damage - a[1].damage);
  });
  return (
    <>
      <For each={f().deaths ?? []}>
        {(d) => (
          <section class="recap">
            <h3>{who(f(), d.id)} died at {clock(d.ms)}{d.up >= 0 ? `, up again at ${clock(d.up)}` : ""}</h3>
            <For each={d.hits} fallback={<p class="ui-muted">Nothing that hit was seen in the last six seconds.</p>}>
              {([ms, skill, damage, hp]) => (
                <div class="ui-row-item" data-left={hp >= 0 || undefined} style={{ "--left": hp >= 0 ? hp / Math.max(1, ...d.hits.map((h) => h[3] + h[2])) : 0 }}>
                  <span class="ui-muted ui-num">{((ms - d.ms) / 1000).toFixed(1)} s</span>
                  <span>{nameOf(f(), skill)}</span>
                  <span class="ui-num">{full(damage)}</span>
                  <span class="ui-muted ui-num">{hp < 0 ? "" : hp === 0 ? "dead" : `${short(hp)} left`}</span>
                </div>
              )}
            </For>
          </section>
        )}
      </For>
      <Show when={skills().length}>
        <section class="block">
          <h2>What hit you</h2>
          <Lanes
            label="What hit you and when"
            ms={f().ms}
            lanes={skills().slice(0, 12).map(([skill, s]) => ({
              name: nameOf(f(), skill),
              note: `${s.hits}, ${short(s.damage)}`,
              color: avoid().includes(skill) ? "var(--tone-danger)" : "var(--accent)",
              marks: s.times.map((t) => ({ from: t, to: t, tip: clock(t) })),
            }))}
          />
          <p class="ui-muted ui-small">Mark what you could have avoided on the Bosses page. Marked skills are red.</p>
        </section>
      </Show>
      <Show when={(f().you?.hitsTaken ?? 0) > 0}>
        <p class="report-line ui-muted">You took {full(f().you!.taken)} in {f().you!.hitsTaken} hits and met {f().you!.blocked ?? 0} of them with a block or parry.</p>
      </Show>
    </>
  );
}

function Heals(props: { fight: Saved }) {
  const rows = createMemo(() => rowsOf(props.fight).filter((r) => r.healing).sort((a, b) => b.healing! - a.healing!));
  const [picked, setPicked] = createSignal<number>();
  const row = () => rows().find((r) => r.id === picked()) ?? rows()[0];
  const total = () => rows().reduce((sum, r) => sum + r.healing!, 0);
  const over = (r: FightRow) => overheal(r.heals);
  return (
    <>
      <div class="board" data-heals>
        <For each={rows()}>
          {(r) => (
            <button
              class="board-row"
              aria-pressed={r.id === row()?.id}
              onClick={() => setPicked(r.id)}
              style={{ "--class": classOf(r.job).color, "--length": r.healing! / rows()[0].healing! }}
            >
              <i class="meter-bar" />
              <ClassMark job={r.job} />
              <span class="meter-name">{who(props.fight, r.id)}</span>
              <small class="ui-num">{short(r.healing!)}</small>
              <small class="ui-num">{percent(r.healing!, total())}</small>
              <small class="ui-num">{over(r) === undefined ? "" : `${percent(over(r)!, 1)} over`}</small>
              <b class="ui-num">{short(r.healing! / Math.max(1, props.fight.ms / 1000))}</b>
            </button>
          )}
        </For>
      </div>
      <Show when={row()?.heals?.length}>
        <section class="block">
          <h2>{who(props.fight, row()!.id)}</h2>
          <For each={row()!.heals}>
            {(s) => (
              <div class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) 90px 110px 90px 110px" }}>
                <span><Pic skill={s.code} name={s.name || "Skill"} /> {s.name || `Skill ${s.code}`}{s.dot ? " over time" : ""}</span>
                <span class="ui-muted ui-num">{full(s.hits)} heals</span>
                <span class="ui-muted ui-num">{short(s.damage / Math.max(1, s.hits))} each</span>
                <span class="ui-muted ui-num">{overheal([s]) === undefined ? "" : `${percent(overheal([s])!, 1)} over`}</span>
                <span class="ui-share" style={{ "--share": s.damage / row()!.heals![0].damage }}>{short(s.damage)}</span>
              </div>
            )}
          </For>
        </section>
      </Show>
      <Show when={rows().some((r) => over(r) !== undefined)}>
        <p class="ui-muted ui-small">Over is healing beyond what was missing, worked out from the health seen before and after. An estimate.</p>
      </Show>
    </>
  );
}

function Stagger(props: { fight: Saved }) {
  const f = () => props.fight;
  const sums = createMemo(() => {
    const by = new Map<string, number>();
    for (const w of f().stagger ?? []) for (const [id, value] of Object.entries(w.by)) by.set(id, (by.get(id) ?? 0) + value);
    return [...by].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  });
  return (
    <>
      <Lanes
        label="Stagger gauges over the fight"
        ms={f().ms}
        lanes={(f().stagger ?? []).map((w) => ({
          name: w.broke ? "Broken" : "Missed",
          note: clock(w.end - w.start),
          color: w.broke ? "var(--tone-ready)" : "var(--tone-danger)",
          marks: [{ from: w.start, to: w.end, tip: `${clock(w.start)} to ${clock(w.end)}` }],
        }))}
      />
      <section class="block">
        <h2>Who wore it down</h2>
        <For each={sums()}>
          {([id, value]) => (
            <div class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) 110px" }}>
              <span>{who(f(), Number(id))}</span>
              <span class="ui-share" style={{ "--share": value / sums()[0][1] }}>{full(value)}</span>
            </div>
          )}
        </For>
      </section>
    </>
  );
}

const shown = (f: Figure, v: number | undefined) =>
  v === undefined ? "" : f.kind === "percent" ? `${(v * 100).toFixed(1)}%` : f.kind === "time" ? clock(v) : v < 1_000 && !Number.isInteger(v) ? v.toFixed(1) : short(v);

function Compare(props: { fight: Saved; others: Saved[]; best?: Saved }) {
  const [picked, setPicked] = createSignal<string>();
  const id = () => (props.others.some((f) => f.id === picked()) ? picked()! : (props.others.find((f) => f.id === props.best?.id) ?? props.others[0])?.id);
  const [loaded] = createResource(id, loadFight);
  const other = () => (loaded()?.id === id() ? loaded() : undefined);
  const tone = (change: number, more: boolean) => (change === 0 ? undefined : change > 0 === more ? "better" : "worse");
  return (
    <>
      <div class="report-line">
        <select class="ui-select" aria-label="Compare with" disabled={props.others.length < 2} value={id()} onChange={(e) => setPicked(e.currentTarget.value)}>
          <For each={props.others.slice(0, 100)}>
            {(f) => <option value={f.id}>{new Date(f.start).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}, {short(f.you?.dps ?? 0)}{f.id === props.best?.id ? ", your best" : ""}</option>}
          </For>
        </select>
      </div>
      <Show when={other()}>
        {(o) => {
          const l = createMemo(() => (props.fight.dummy ? luck(o(), props.fight) : undefined));
          const stats = createMemo(() => statChanges(o(), props.fight));
          return (
            <>
              <Show when={l()}>
                {(l) => (
                  <p class="report-line">
                    {l().real >= 0 ? "Gain" : "Loss"} of {Math.abs(l().real * 100).toFixed(1)}% with crits even, and {Math.abs(l().luck * 100).toFixed(1)}% {l().luck >= 0 ? "more" : "less"} from crit luck.{" "}
                    {l().sure ? "More than chance explains." : "Two runs alike could differ this much."}
                  </p>
                )}
              </Show>
              <Chart curve={props.fight.curve ?? []} best={o().curve} other="the other fight" />
              <section class="block figures" role="table" aria-label="Both fights">
                <div class="figure figure-head" role="row">
                  <span role="columnheader" />
                  <span role="columnheader">Other</span>
                  <span role="columnheader">This</span>
                  <span role="columnheader">Change</span>
                </div>
                <For each={figures(o(), props.fight)}>
                  {(f) => {
                    const change = (f.b ?? 0) - (f.a ?? 0);
                    const known = f.a !== undefined && f.b !== undefined;
                    return (
                      <div class="figure" role="row">
                        <span role="rowheader">{f.name}</span>
                        <span role="cell">{shown(f, f.a)}</span>
                        <b role="cell">{shown(f, f.b)}</b>
                        <span role="cell" class={known ? tone(change, f.more) : undefined}>{known && change ? `${change > 0 ? "+" : "-"}${shown(f, Math.abs(change))}` : ""}</span>
                      </div>
                    );
                  }}
                </For>
              </section>
              <section class="block figures" role="table" aria-label="Skills, damage a second">
                <div class="figure figure-head" role="row">
                  <span role="columnheader">Skill, damage a second</span>
                  <span role="columnheader">Other</span>
                  <span role="columnheader">This</span>
                  <span role="columnheader">Change</span>
                </div>
                <For each={skillGains(o(), props.fight).slice(0, 12)}>
                  {(s) => (
                    <div class="figure" role="row">
                      <span role="rowheader">{s.name}</span>
                      <span role="cell">{short(s.a)}</span>
                      <b role="cell">{short(s.b)}</b>
                      <span role="cell" class={tone(s.b - s.a, true)}>{`${s.b >= s.a ? "+" : "-"}${short(Math.abs(s.b - s.a))}`}</span>
                    </div>
                  )}
                </For>
              </section>
              <Show when={stats().length}>
                <section class="block figures" role="table" aria-label="Stats that changed">
                  <div class="figure figure-head" role="row">
                    <span role="columnheader">Your stats that changed</span>
                    <span role="columnheader">Other</span>
                    <span role="columnheader">This</span>
                    <span role="columnheader">Change</span>
                  </div>
                  <For each={stats().slice(0, 40)}>
                    {(s) => (
                      <div class="figure" role="row">
                        <span role="rowheader">{s.name}</span>
                        <span role="cell">{full(s.a)}</span>
                        <b role="cell">{full(s.b)}</b>
                        <span role="cell">{`${s.b > s.a ? "+" : "-"}${full(Math.abs(s.b - s.a))}`}</span>
                      </div>
                    )}
                  </For>
                  <p class="ui-muted ui-small">The game numbers its stats. Most have no name here yet.</p>
                </section>
              </Show>
            </>
          );
        }}
      </Show>
    </>
  );
}

const SPEEDS = [[1, "1x"], [4, "4x"], [16, "16x"]] as const;

/** The fight again, from everyone's damage by second. */
function Play(props: { fight: Saved }) {
  const [at, setAt] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const [speed, setSpeed] = createSignal<number>(4);
  createEffect(on(() => props.fight.id, () => { setAt(0); setPlaying(false); }, { defer: true }));
  createEffect(() => {
    if (!playing()) return;
    const timer = setInterval(() => {
      const next = at() + 100 * speed();
      setAt(Math.min(props.fight.ms, next));
      if (next >= props.fight.ms) setPlaying(false);
    }, 100);
    onCleanup(() => clearInterval(timer));
  });
  const value = (curve: readonly number[] | undefined) => {
    if (!curve?.length) return 0;
    const s = at() / 1000;
    const [a, b] = [curve[Math.floor(s) - 1] ?? 0, curve[Math.min(curve.length - 1, Math.floor(s))]];
    return a + (b - a) * (s % 1);
  };
  const rows = createMemo(() =>
    rowsOf(props.fight)
      .map((r, i) => ({ r, name: label(r, hideNames(), i + 1), damage: value(r.curve?.length ? r.curve : r.you ? props.fight.curve : undefined) }))
      .sort((a, b) => b.damage - a.damage),
  );
  const health = () => props.fight.health?.[Math.min(props.fight.health.length - 1, Math.floor(at() / 1000))] ?? -1;
  const play = () => {
    if (at() >= props.fight.ms) setAt(0);
    setPlaying(!playing());
  };
  return (
    <>
      <div class="playback">
        <button class="ui-button" data-main onClick={play}>
          <span class="ui-icon" aria-hidden="true">{playing() ? "" : ""}</span>
          {playing() ? "Pause" : "Play"}
        </button>
        <input class="ui-slider" type="range" aria-label="Time in the fight" min={0} max={props.fight.ms} step={100} value={at()} style={{ "--fill": at() / Math.max(1, props.fight.ms) }} onInput={(e) => setAt(e.currentTarget.valueAsNumber)} />
        <span class="ui-num">{clock(at())} of {clock(props.fight.ms)}</span>
        <Choices name="Speed" all={SPEEDS} value={speed()} set={setSpeed} />
      </div>
      <Show when={health() >= 0 && props.fight.maxHp > 0}>
        <div class="playback-boss">
          <div class="ui-row"><span>{props.fight.target}</span><span class="ui-muted ui-num">{((health() / props.fight.maxHp) * 100).toFixed(1)}%</span></div>
          <div class="ui-meter" data-state="danger"><i style={{ "--value": health() / props.fight.maxHp }} /></div>
        </div>
      </Show>
      <div class="board still">
        <For each={rows()}>
          {({ r, name, damage }) => (
            <div class="board-row" style={{ "--class": classOf(r.job).color, "--length": damage / Math.max(1, rows()[0].damage) }}>
              <i class="meter-bar" />
              <ClassMark job={r.job} />
              <span class="meter-name">{name}</span>
              <small class="ui-num">{short(damage)}</small>
              <b class="ui-num">{short(at() > 0 ? damage / Math.max(1, at() / 1000) : 0)}</b>
            </div>
          )}
        </For>
      </div>
    </>
  );
}
