import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { near } from "../../live/store";
import { change, hideNames, settings } from "../../store";
import { clock, day, full, time } from "../../ui/format";
import { Choices, Line } from "../../ui/Line";
import { Waiting } from "../../ui/Waiting";
import { itemFile, nameFile } from "../map/data";
import { anHour, gradeOf, itemName, kinahGained, rates } from "./logic";
import { GRADE_NAMES } from "../closet/logic";
import { days, rolls } from "./watch";
import "./loot.css";

export function LootPage() {
  const [file] = createResource(() => itemFile().catch(() => null));
  const [names] = createResource(() => nameFile().catch(() => null));
  const [at, setAt] = createSignal(0);
  const [query, setQuery] = createSignal("");
  const shown = () => days()[Math.min(at(), Math.max(0, days().length - 1))];
  const chosen = (item: number) => settings.loot.rules.includes(item);
  const choose = (item: number) => change((s) => (s.loot.rules = chosen(item) ? s.loot.rules.filter((i) => i !== item) : [...s.loot.rules, item]));
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  const listOf = (o: Record<string, number>) =>
    Object.entries(o)
      .map(([id, n]) => ({ id: Number(id), n }))
      .filter((r) => !query() || itemName(file(), r.id).toLowerCase().includes(query().toLowerCase()))
      .sort((a, b) => Number(chosen(b.id)) - Number(chosen(a.id)) || b.n - a.n);
  const kept = createMemo(() => rates(days()));
  const who = (name: string) => (name && name === near.you?.name ? "You" : hideNames() ? "A player" : name || "You");
  const grades = () => GRADE_NAMES.map((g, i) => [i, g] as const);

  const Items = (props: { title: string; of: Record<string, number> }) => (
    <section class="block">
      <h2>{props.title}</h2>
      <Show when={listOf(props.of).length} fallback={<p class="ui-muted ui-small">None yet.</p>}>
        <For each={listOf(props.of)}>
          {(r) => (
            <div class="ui-row-item loot-row">
              <span data-grade={gradeOf(file(), r.id) || undefined}>{itemName(file(), r.id)}</span>
              <b class="ui-num">{full(r.n)}</b>
              <span class="ui-muted ui-num">{shown().active >= 60_000 ? `${full(Math.round(anHour(r.n, shown().active)))} an hour` : ""}</span>
              <button class="ui-chip" aria-pressed={chosen(r.id)} aria-label={`Choose ${itemName(file(), r.id)}`} onClick={() => choose(r.id)}>Chosen</button>
            </div>
          )}
        </For>
      </Show>
    </section>
  );

  return (
    <div class="page">
      <header class="page-head">
        <h1>Loot</h1>
        <input class="ui-input" type="search" placeholder="Search an item" aria-label="Search an item" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
      </header>
      <Show when={file() === null}><p class="ui-muted ui-small">Items show by number: there are no item names yet. The engine's tools/items.py makes them.</p></Show>
      <Show when={shown()} fallback={<Waiting idle="Loot is kept here from one daily reset to the next, as you gain it." />}>
        {(d) => (
          <>
            <div class="ui-row" role="group" aria-label="Day">
              <For each={days().slice(0, 7)}>{(x, i) => <button class="ui-chip" aria-pressed={i() === at()} onClick={() => setAt(i())}>{day(x.start + 3_600_000)}</button>}</For>
            </div>
            <div class="stats">
              <div class="stat" data-hero><small>Active</small><b class="ui-num">{clock(d().active)}</b></div>
              <div class="stat"><small>Items gained</small><b class="ui-num">{full(sum(d().gained))}</b></div>
              <div class="stat"><small>Gathered</small><b class="ui-num">{full(sum(d().gathered))}</b></div>
              <div class="stat"><small>Your kills</small><b class="ui-num">{full(sum(d().kills))}</b></div>
              <div class="stat"><small>Kinah, as Plume saw it</small><b class="ui-num">{full(kinahGained(d()))}</b></div>
              <Show when={d().active >= 60_000 && kinahGained(d())}><div class="stat"><small>Kinah an hour</small><b class="ui-num">{full(Math.round(anHour(kinahGained(d()), d().active)))}</b></div></Show>
            </div>
            <Items title="Items gained" of={d().gained} />
            <Items title="Gathered" of={d().gathered} />
          </>
        )}
      </Show>

      <section class="block">
        <h2>Your drop rates</h2>
        <p class="ui-muted ui-small">Your own drops from monsters you hit, over the days kept. The game's chances are on the Map's monster cards.</p>
        <Show when={kept().length} fallback={<p class="ui-muted ui-small">None yet.</p>}>
          <For each={kept().slice(0, 100)}>
            {(r) => (
              <div class="ui-row-item loot-row">
                <span data-grade={gradeOf(file(), r.item) || undefined}>{itemName(file(), r.item)} <span class="ui-muted">from {names()?.monsters[r.mob]?.[0] ?? `monster ${r.mob}`}</span></span>
                <b class="ui-num">{((r.drops / r.kills) * 100).toFixed(1)}%</b>
                <span class="ui-muted ui-num">{r.drops} of {r.kills}</span>
                <span />
              </div>
            )}
          </For>
        </Show>
      </section>

      <section class="block">
        <h2>Dice Rolls</h2>
        <Show when={rolls().length} fallback={<p class="ui-muted ui-small">None yet. They are kept here, since chat scrolls away.</p>}>
          <For each={rolls().slice(0, 30)}>
            {(r) => (
              <div class="ui-row-item roll-row">
                <span data-grade={gradeOf(file(), r.item) || undefined}>{r.item ? itemName(file(), r.item) : "An item"}{r.count > 1 ? ` x${r.count}` : ""}</span>
                <span class="ui-small ui-num">{r.rolls.map((x) => `${x.you ? "You" : who(x.name)} ${x.roll}`).join(", ") || "No rolls seen"}{r.passed.length ? `; ${r.passed.length} passed` : ""}</span>
                <span class="ui-small">{r.winner ? `${who(r.winner)} won` : r.ends && r.ends < Date.now() ? "Ended" : "Open"}, {time(r.at)}</span>
              </div>
            )}
          </For>
        </Show>
      </section>

      <section class="block">
        <h2>Diary</h2>
        <For each={days()}>
          {(x) => (
            <div class="ui-row-item loot-row">
              <span>{day(x.start + 3_600_000)}</span>
              <span class="ui-num">{clock(x.active)} active</span>
              <span class="ui-num">{full(sum(x.gained))} items</span>
              <span class="ui-num">{full(kinahGained(x))} Kinah</span>
            </div>
          )}
        </For>
      </section>

      <section class="block">
        <Line name="Loot feed shows" about="From this grade up. The items you chose always show, and sound with the alert An item you chose.">
          <Choices name="Loot feed shows" all={grades()} value={settings.loot.least} set={(v) => change((s) => (s.loot.least = v))} />
        </Line>
      </section>
    </div>
  );
}
