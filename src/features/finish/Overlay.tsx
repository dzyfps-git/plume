import { createMemo, createSignal, For, Show } from "solid-js";
import { demoSaved } from "../../live/demo";
import type { FightRow, Saved } from "../../live/types";
import { settings } from "../../store";
import { ClassMark, classOf } from "../../ui/classes";
import { clock, percent, short } from "../../ui/format";
import { Drawn } from "../../ui/icons";
import { onKept } from "../history/store";
import { gain, label, shown, signed } from "../meter/logic";
import { standing, titles } from "../report/deep";
import "../meter/meter.css";
import "./finish.css";

/** The card stays this long. */
const STAY = 14_000;
/** A fight shorter than this has no card. */
const LEAST = 15_000;

const [card, setCard] = createSignal<{ fight: Saved; gain?: number }>();
export const empty = () => !card();

/** Shows the card when a boss falls. */
export function followFinish() {
  onKept((fight, all) => {
    if (!fight.killed || fight.dummy || fight.ms < LEAST) return;
    const next = { fight, gain: gain(fight, all) };
    setCard(next);
    setTimeout(() => setCard((now) => (now === next ? undefined : now)), STAY);
  });
}

let made: Saved | undefined;
/** To place it by. */
const sample = () => ({ fight: (made ??= demoSaved("sample", { ms: 152_000, seed: 3, killed: true })), gain: 0.04 });

export function FinishOverlay() {
  const now = createMemo(() => card() ?? sample());
  const rows = () => now().fight.rows ?? [];
  const places = createMemo(() => {
    const list = standing(now().fight).map((m) => ({ ...m, row: rows().find((r) => r.id === m.id)! }));
    const alone = now().fight.you;
    // Alone there is nobody to be better than, and your numbers still count.
    return shown(list.length || !alone ? list : [{ id: alone.id, points: 0, damage: 0, healing: 0, stagger: 0, deaths: 0, row: alone }], 4);
  });
  const named = createMemo(() => titles(now().fight));
  const name = (r: FightRow, rank: number) => label(r, settings.meter.hideNames, rank);
  const broken = () => rows().reduce((n, r) => n + (r.stagger ?? 0), 0);
  return (
    <section class="finish" aria-label="End of the fight">
      <header>
        <span>{now().fight.target} fell in <b class="ui-num">{clock(now().fight.ms)}</b></span>
        <Show when={now().gain}>{(g) => <em class="ui-num"><Drawn name="crown" /> New best, {signed(g())}</em>}</Show>
      </header>
      <Show when={places()[0]}>
        {(top) => (
          <div class="finish-top" style={{ "--class": classOf(top().row.job).color }}>
            <span class="finish-ring">
              <svg viewBox="0 0 80 80" aria-hidden="true">
                <circle cx="40" cy="40" r="36" />
              </svg>
              <ClassMark job={top().row.job} />
            </span>
            <div>
              <Show when={rows().length > 1}><strong class="finish-mvp"><Drawn name="crown" /><span>MVP</span></strong></Show>
              <b class="finish-name">{name(top().row, 1)}</b>
              <div class="finish-figures ui-num">
                <span><b>{short(top().row.dps)}</b><small>a second</small></span>
                <span><b>{percent(top().row.damage, now().fight.total)}</b><small>damage</small></span>
                <Show when={broken() > 0}><span><b>{percent(top().row.stagger ?? 0, broken())}</b><small>stagger</small></span></Show>
                <Show when={rows().length > 1}><span><b>{Math.round(top().points)}</b><small>points</small></span></Show>
              </div>
            </div>
          </div>
        )}
      </Show>
      <Show when={places().length > 1}>
        <div class="finish-places">
          <For each={places().slice(1)}>
            {(p) => (
              <div class="finish-place" data-you={p.row.you || undefined} style={{ "--class": classOf(p.row.job).color }}>
                <span class="finish-rank ui-num" data-rank={p.rank}>{p.rank}</span>
                <ClassMark job={p.row.job} />
                <b class="finish-name">{name(p.row, p.rank)}</b>
                <small>{named().get(p.id) ?? `${percent(p.row.damage, now().fight.total)} of the damage`}</small>
                <b class="ui-num">{short(p.row.dps)}</b>
              </div>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}
