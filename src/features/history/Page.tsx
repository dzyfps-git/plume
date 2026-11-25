import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { exportFile } from "../../api";
import type { Saved } from "../../live/types";
import { clock, day, full, short, time } from "../../ui/format";
import { CLASSES } from "../../ui/classes";
import { Pair, Report } from "../report/Report";
import { left } from "../report/logic";
import { bytes, csv } from "../report/share";
import { alike, bestOf, bests, byDay, characters, filtered, rdps, runs, session, tick, tries, type Filter, type Run } from "./logic";
import { fights, followFights } from "./store";
import "./history.css";

const FILTERS: [Filter, string][] = [["all", "All"], ["bosses", "Bosses"], ["kills", "Kills"], ["dummies", "Dummies"], ["runs", "Dungeon runs"], ["session", "Last session"], ["table", "Table"]];

/** Whose fights to show. Empty is every character's. */
const [mine, setMine] = createSignal("");

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
          <Match when={filter() === "session"}>
            <div class="history-detail"><Session fights={list()} /></div>
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
                        <b class="ui-num">{short(f.you?.dps ?? 0)}</b>
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
        <For each={["When", "Target", "", "Time", "Total", "You, a second", "rDPS", "Combat Power", "Deaths"]}>{(name) => <span>{name}</span>}</For>
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

function RunCard(props: { run: Run; open: (id: string) => void }) {
  return (
    <section class="block">
      <h2>{day(props.run.run)}, {time(props.run.run)}</h2>
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
          <button class="ui-row-item" style={{ "--columns": "minmax(0, 1fr) 100px 90px 90px" }} onClick={() => props.open(f.id)}>
            <span>{f.target}</span>
            <span class="ui-muted">{f.killed ? "killed" : "not killed"}</span>
            <span class="ui-muted ui-num">{clock(f.ms)}</span>
            <span class="ui-share" style={{ "--share": (f.you?.dps ?? 0) / Math.max(1, ...props.run.fights.map((x) => x.you?.dps ?? 0)) }}>{short(f.you?.dps ?? 0)}</span>
          </button>
        )}
      </For>
    </section>
  );
}
