import { createMemo, createResource, createSignal, For, Match, Show, Switch } from "solid-js";
import { dungeonFile } from "../map/data";
import { exportFile, openPage } from "../../api";
import type { Saved } from "../../live/types";
import { clock, day, full, short, time } from "../../ui/format";
import { CLASSES } from "../../ui/classes";
import { Pair, Report } from "../report/Report";
import { left } from "../report/logic";
import { bytes, csv } from "../report/share";
import { Grade } from "../best/Grade";
import { apart, beside, bestRun, fastest, records, splits, streak, streaks, type Streak } from "../best/logic";
import { verdicts } from "../training/verdicts";
import { Pic } from "../../ui/Pic";
import { alike, bestOf, bests, byDay, characters, filtered, rdps, runs, session, tick, tries, week, type Filter, type Run } from "./logic";
import { allGrades, allRuns, fights, followFights } from "./store";
import "./history.css";

const FILTERS: [Filter, string][] = [["all", "All"], ["bosses", "Bosses"], ["kills", "Kills"], ["dummies", "Dummies"], ["runs", "Dungeon runs"], ["session", "Last session"], ["week", "Your week"], ["table", "Table"], ["records", "Records"]];

/** Whose fights to show. Empty is every character's. */
const [mine, setMine] = createSignal("");

/** Opens History with one character's fights. */
export function showFightsOf(name: string) {
  setMine(name);
  void openPage("history");
}

export function HistoryPage() {
  followFights();
  const [filter, setFilter] = createSignal<Filter>("all");
  const [search, setSearch] = createSignal("");
  const [picked, setPicked] = createSignal<string>();
  const [ticked, setTicked] = createSignal<string[]>([]);
  const people = createMemo(() => characters(fights()));
  const person = () => (people().some((c) => c.name === mine()) ? mine() : "");
  const own = createMemo(() => (person() ? fights().filter((f) => f.you?.name === person()) : fights()));
  const best = createMemo(() => bests(own()));
  const list = createMemo(() => filtered(filter() === "session" ? session(own()) : own(), filter(), search()));
  // The older one is what the newer is held against.
  const pair = createMemo(() => own().filter((f) => ticked().includes(f.id)).sort((a, b) => a.start - b.start));
  const show = (id: string) => {
    setFilter("all");
    setPicked(id);
  };
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
        <Show when={people().length > 1}>
          <select class="ui-select" aria-label="Character" value={person()} onChange={(e) => setMine(e.currentTarget.value)}>
            <option value="">Every character</option>
            <For each={people()}>{(c) => <option value={c.name} selected={c.name === person()}>{c.name}{c.job ? `, ${CLASSES[c.job].name}` : ""}</option>}</For>
          </select>
        </Show>
        <input class="ui-input" placeholder="Search targets" aria-label="Search targets" onInput={(e) => setSearch(e.currentTarget.value)} />
        <button
          class="ui-icon-button"
          aria-label="Save this list as CSV, your numbers only"
          onClick={() => void exportFile("fights.csv", bytes(`\ufeff${csv(list())}`)).catch(console.error)}
        >
          {"\ue74e"}
        </button>
      </header>
      <Show
        when={list().length}
        fallback={
          <div class="ui-empty">
            <span class="ui-icon" aria-hidden="true">{""}</span>
            <p>{fights().length ? "No fight matches." : "Your boss and dummy fights are kept here. Only your own part of them is written down."}</p>
          </div>
        }
      >
        <Switch>
          <Match when={filter() === "runs"}>
            <div class="history-detail"><For each={runs(list())}>{(run) => <RunCard run={run} open={show} />}</For></div>
          </Match>
          <Match when={filter() === "table"}>
            <div class="history-detail"><Table fights={list()} best={best()} open={show} /></div>
          </Match>
          <Match when={filter() === "records"}>
            <div class="history-detail"><Records fights={list()} open={show} /></div>
          </Match>
          <Match when={filter() === "session"}>
            <div class="history-detail"><Session fights={list()} /></div>
          </Match>
          <Match when={filter() === "week"}>
            <div class="history-detail"><Week fights={list()} /></div>
          </Match>
          <Match when={true}>
        <div class="history-panes">
          <div class="history-list">
            <Show when={pair().length}>
              <div class="history-pair">
                <span class="ui-muted ui-small">{pair().length < 2 ? "Tick one more to compare." : "Two fights compared."}</span>
                <button class="ui-button" onClick={() => setTicked([])}>Untick</button>
              </div>
            </Show>
            <For each={byDay(list(), day)}>
              {([name, items]) => (
                <>
                  <div class="ui-heading">{name}</div>
                  <For each={items}>
                    {(f) => (
                      <div class="history-line">
                      <input type="checkbox" class="ui-check" aria-label={`Compare ${f.target}, ${time(f.start)}`} checked={ticked().includes(f.id)} onChange={() => setTicked((t) => tick(t, f.id))} />
                      <button
                        class="ui-row-item history-item"
                        aria-selected={pair().length === 2 ? ticked().includes(f.id) : f.id === open()?.id}
                        onClick={() => {
                          setTicked([]);
                          setPicked(f.id);
                        }}
                      >
                        <span class="history-name">
                          {f.target}
                          <Show when={bestOf(best(), f)?.id === f.id}>
                            <span class="ui-tag" style={{ "--tag": "var(--accent)" }}>Best</span>
                          </Show>
                        </span>
                        <span class="history-grade"><Grade of={allGrades().get(f.id)} /><b class="ui-num">{short(f.you?.dps ?? 0)}</b></span>
                        <small class="ui-muted ui-num">
                          {time(f.start)}, {clock(f.ms)}{f.dummy ? "" : f.killed ? ", killed" : left(f) !== undefined ? `, ${(left(f)! * 100).toFixed(0)}% left` : ", not killed"}
                        </small>
                      </button>
                      </div>
                    )}
                  </For>
                </>
              )}
            </For>
          </div>
          <Show when={pair().length === 2} fallback={<Show when={open()}>{(f) => <Report fight={f()} best={bestOf(best(), f())} others={alike(own(), f())} />}</Show>}>
            <Pair older={pair()[0]} newer={pair()[1]} />
          </Show>
        </div>
          </Match>
        </Switch>
      </Show>
    </div>
  );
}

/** Every fight in a line. */
function Table(props: { fights: Saved[]; best: Map<string, Saved>; open: (id: string) => void }) {
  return (
    <div class="history-table ui-num">
      <div class="ui-row-item history-table-head">
        <For each={["When", "Target", "", "Time", "Total", "You, a second", "Grade", "rDPS", "Combat Power", "Deaths"]}>{(name) => <span>{name}</span>}</For>
      </div>
      <For each={props.fights.slice(0, 300)}>
        {(f) => (
          <button class="ui-row-item" onClick={() => props.open(f.id)}>
            <span class="ui-muted">{new Date(f.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {time(f.start)}</span>
            <span>{f.target}</span>
            <span class="ui-muted">{f.dummy ? "dummy" : f.killed ? "killed" : "not killed"}</span>
            <span>{clock(f.ms)}</span>
            <span>{short(f.total)}</span>
            <b>{bestOf(props.best, f)?.id === f.id ? <span class="ui-tag" style={{ "--tag": "var(--accent)" }}>Best</span> : ""} {short(f.you?.dps ?? 0)}</b>
            <span><Grade of={allGrades().get(f.id)} /></span>
            <span>{rdps(f) === undefined ? "" : short(rdps(f)!)}</span>
            <span>{f.you?.power ? full(f.you.power) : ""}</span>
            <span>{f.you?.deaths || ""}</span>
          </button>
        )}
      </For>
      <Show when={props.fights.length > 300}><p class="ui-muted ui-small">The newest 300 of {props.fights.length}.</p></Show>
    </div>
  );
}

/** Each of the last seven days as a bar of time fought, with its kills, damage and records. */
function Week(props: { fights: Saved[] }) {
  const days = createMemo(() => week(props.fights, Date.now()));
  const most = () => Math.max(1, ...days().map((d) => d.ms));
  const sum = (k: "ms" | "kills" | "damage" | "records") => days().reduce((n, d) => n + d[k], 0);
  return (
    <>
      <div class="stats">
        <div class="stat" data-hero><small>Time fought</small><b class="ui-num">{clock(sum("ms"))}</b></div>
        <div class="stat"><small>Kills</small><b class="ui-num">{sum("kills")}</b></div>
        <div class="stat"><small>Your damage</small><b class="ui-num">{short(sum("damage"))}</b></div>
        <div class="stat"><small>Records</small><b class="ui-num">{sum("records")}</b></div>
      </div>
      <section class="block history-week">
        <For each={days()}>
          {(d) => (
            <div class="ui-row-item" style={{ "--columns": "110px minmax(0, 1fr) 70px 80px 90px 90px" }}>
              <span>{day(d.start + 3_600_000)}</span>
              <span class="week-bar" style={{ "--part": d.ms / most() }} />
              <span class="ui-num">{clock(d.ms)}</span>
              <span class="ui-muted ui-num">{d.kills} {d.kills === 1 ? "kill" : "kills"}</span>
              <span class="ui-muted ui-num">{short(d.damage)}</span>
              <span class="ui-muted ui-num">{d.records ? `${d.records} ${d.records === 1 ? "record" : "records"}` : ""}</span>
            </div>
          )}
        </For>
        <p class="ui-muted ui-small">From one daily reset to the next. A record is a fight better than every one of its kind before it.</p>
      </section>
    </>
  );
}

function Session(props: { fights: Saved[] }) {
  const list = createMemo(() => tries(props.fights));
  const all = () => props.fights.reduce((n, f) => n + f.ms, 0);
  return (
    <>
      <div class="stats">
        <div class="stat" data-hero>
          <small>Time fought</small>
          <b class="ui-num">{clock(all())}</b>
        </div>
        <div class="stat">
          <small>Fights</small>
          <b class="ui-num">{props.fights.length}</b>
        </div>
        <div class="stat">
          <small>Killed</small>
          <b class="ui-num">{props.fights.filter((f) => f.killed).length}</b>
        </div>
        <div class="stat">
          <small>Your deaths</small>
          <b class="ui-num">{props.fights.reduce((n, f) => n + (f.you?.deaths ?? 0), 0)}</b>
        </div>
      </div>
      <section class="block">
        <For each={list()}>
          {(t) => (
            <div class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) 100px 130px 90px 80px" }}>
              <span>{t.target}</span>
              <span class="ui-muted ui-num">{t.tries} {t.tries === 1 ? "try" : "tries"}</span>
              <span class="ui-muted ui-num">{t.kills ? `${t.kills} killed` : t.closest !== undefined ? `${(t.closest * 100).toFixed(1)}% left` : ""}</span>
              <span class="ui-muted ui-num">{clock(t.ms)}</span>
              <span class="ui-share" style={{ "--share": t.best / Math.max(1, ...list().map((x) => x.best)) }}>{short(t.best)}</span>
            </div>
          )}
        </For>
      </section>
    </>
  );
}

/** Biggest hits, fastest kills and streaks. */
function Records(props: { fights: Saved[]; open: (id: string) => void }) {
  const hits = createMemo(() => records(props.fights).slice(0, 40));
  const kills = createMemo(() => fastest(props.fights));
  const rows = createMemo(() => streaks(props.fights));
  const runs = createMemo(() => props.fights.filter((f) => f.dummy && f.you));
  const verdict = verdicts(runs);
  const clean = createMemo(() => streak(runs().map(verdict).filter((why) => why !== undefined).map((why) => !why.length)));
  const all = (): [string, Streak, string][] => [["Kills in a row", rows().kills, ""], ["Pulls without dying", rows().alive, ""], ["Clean training runs in a row", clean(), "Of your newest 20"]];
  const when = (at: number) => `${day(at)}, ${time(at)}`;
  return (
    <>
      <div class="stats">
        <For each={all()}>
          {([name, s, tip]) => (
            <div class="stat">
              <small>{name}</small>
              <b class="ui-num" data-tip={tip || undefined}>{s.now} <small class="ui-muted">most {s.most}</small></b>
            </div>
          )}
        </For>
      </div>
      <Show when={hits().length}>
        <section class="block">
          <h2>Biggest hit with each skill</h2>
          <For each={hits()}>
            {(r) => (
              <button class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) minmax(0, 1fr) 160px 90px" }} onClick={() => props.open(r.id)}>
                <span class="history-skill"><Pic skill={r.skill} name={r.name || "Skill"} /> {r.name || `Skill ${r.skill}`}</span>
                <span class="ui-muted">{r.target}</span>
                <span class="ui-muted ui-num">{when(r.start)}</span>
                <span class="ui-share" style={{ "--share": r.amount / hits()[0].amount }}>{full(r.amount)}</span>
              </button>
            )}
          </For>
        </section>
      </Show>
      <Show when={kills().length}>
        <section class="block">
          <h2>Fastest kills</h2>
          <For each={kills()}>
            {(k) => (
              <button class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) 90px 90px 160px 70px" }} onClick={() => props.open(k.kill.id)}>
                <span>{k.kill.target}</span>
                <span class="ui-muted ui-num">{short(k.kill.maxHp)} HP</span>
                <span class="ui-muted ui-num">{k.kills} {k.kills === 1 ? "kill" : "kills"}</span>
                <span class="ui-muted ui-num">{when(k.kill.start)}</span>
                <b class="ui-num">{clock(k.kill.ms)}</b>
              </button>
            )}
          </For>
        </section>
      </Show>
    </>
  );
}

function RunCard(props: { run: Run; open: (id: string) => void }) {
  // "Krao Cave, hard". Nothing without the engine's `dungeons.json`; the file is read once.
  const [dungeons] = createResource(() => dungeonFile().catch(() => ({}) as Record<string, [string, string]>));
  const place = () => {
    const [name, hard] = dungeons()?.[props.run.dungeon] ?? ["", ""];
    return name && `${hard ? `${name}, ${hard}` : name}, `;
  };
  // Against the best of the others. A run that beat them all is the best itself.
  const other = createMemo(() => bestRun(allRuns(), props.run.dungeon, props.run.run));
  const first = createMemo(() => bestRun(allRuns(), props.run.dungeon)?.run === props.run.run && !!other());
  const mine = createMemo(() => splits(props.run.fights));
  const cuts = createMemo(() => new Map(beside(mine(), splits(other()?.fights ?? [])).map((l) => [l.name + l.at, l])));
  const cut = (f: Saved) => {
    const l = f.killed ? cuts().get(f.target + (f.start + f.ms - props.run.fights[0].start)) : undefined;
    return l?.best === undefined || l.at === undefined ? undefined : l.best - l.at;
  };
  return (
    <section class="block">
      <h2>{place()}{day(props.run.run)}, {time(props.run.run)} <Show when={first()}><span class="ui-tag" style={{ "--tag": "var(--tone-best)" }}>Best run</span></Show></h2>
      <div class="stats">
        <div class="stat" data-hero>
          <small>First pull to last</small>
          <b class="ui-num">{clock(props.run.ms)}</b>
        </div>
        <div class="stat">
          <small>Fighting bosses</small>
          <b class="ui-num">{clock(props.run.fought)}</b>
        </div>
        <div class="stat">
          <small>Your damage</small>
          <b class="ui-num">{short(props.run.damage)}</b>
        </div>
        <div class="stat">
          <small>You, a second in fights</small>
          <b class="ui-num">{short(props.run.damage / Math.max(1, props.run.fought / 1000))}</b>
        </div>
        <div class="stat">
          <small>Your deaths</small>
          <b class="ui-num">{props.run.deaths}</b>
        </div>
      </div>
      <For each={props.run.fights}>
        {(f) => (
          <button class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) 100px 70px 90px 90px" }} onClick={() => props.open(f.id)}>
            <span>{f.target}</span>
            <span class="ui-muted">{f.killed ? "killed" : "not killed"}</span>
            <span class="ui-num" data-tip={cut(f) === undefined ? undefined : `Fell at ${clock(f.start + f.ms - props.run.fights[0].start)}, against your best other run`} classList={{ ahead: (cut(f) ?? 0) >= 0, behind: (cut(f) ?? 0) < 0 }}>{cut(f) === undefined ? "" : apart(cut(f)!)}</span>
            <span class="ui-muted ui-num">{clock(f.ms)}</span>
            <span class="ui-share" style={{ "--share": (f.you?.dps ?? 0) / Math.max(1, ...props.run.fights.map((x) => x.you?.dps ?? 0)) }}>{short(f.you?.dps ?? 0)}</span>
          </button>
        )}
      </For>
    </section>
  );
}
