import { createEffect, createMemo, createRoot, createSignal, For, Show, untrack } from "solid-js";
import { fight, near, sampling } from "../../live/store";
import { clock } from "../../ui/format";
import { ticking } from "../../ui/now";
import { apart, beside, bestRun, splits, type Split } from "../best/logic";
import { allRuns, fights, followFights } from "../history/store";
import "../meter/meter.css";
import "../best/best.css";
import "./splits.css";

/** To place it by. */
const DEMO: { now: Split[]; best: Split[] } = {
  now: [{ key: "1", name: "Gatekeeper", at: 94_000 }, { key: "2", name: "Frost Matron", at: 251_000 }],
  best: [{ key: "1", name: "Gatekeeper", at: 101_000 }, { key: "2", name: "Frost Matron", at: 244_000 }, { key: "3", name: "Stormbound Warden", at: 430_000 }],
};

/** When the first pull of this run was, seen live: a fight is kept only once it is over. */
const [pull, setPull] = createSignal(0);
let following = false;
function follow() {
  if (following) return;
  following = true;
  followFights();
  createRoot(() => {
    let run = 0;
    createEffect(() => {
      const [now, fought] = [sampling() ? 0 : near.run, fight.target.boss && near.fighting && fight.rows.length > 0 && fight.ms > 0];
      untrack(() => {
        if (now !== run) setPull(0);
        run = now;
        if (run && fought && !pull()) setPull(Date.now() - fight.ms);
      });
    });
  });
}

const mine = () => (near.run ? fights().filter((f) => f.run === near.run && f.dungeon === near.dungeon) : []);
const best = () => (near.run ? bestRun(allRuns(), near.dungeon, near.run) : undefined);
/** The overlay is there only in a dungeon with something to say. */
export const bare = () => {
  follow();
  return !near.run || (!pull() && !mine().length && !best());
};

export function SplitsOverlay() {
  follow();
  const now = ticking();
  // Made-up bosses only to place it by. Out of a run in play, it says so.
  const demo = sampling;
  const done = createMemo(() => (demo() ? DEMO.now : splits(mine())));
  const before = createMemo(() => (demo() ? DEMO.best : splits(best()?.fights ?? [])));
  const lines = createMemo(() => beside(done(), before()));
  const start = () => [...mine().map((f) => f.start), ...(pull() ? [pull()] : [])].reduce((a, b) => Math.min(a, b), Infinity);
  // It stops with the last boss your best run had.
  const over = () => before().length > 0 && lines().every((l) => l.at !== undefined);
  const elapsed = () => (demo() ? 312_000 : over() ? done().at(-1)!.at : Number.isFinite(start()) ? Math.max(0, now() - start()) : 0);
  const next = createMemo(() => lines().find((l) => l.at === undefined)?.key);
  return (
    <section class="splits glass ui-num" aria-label="Run splits">
      <header>
        <strong>Run</strong>
        <Show when={before().length}><small>best {clock(before().at(-1)!.at)}</small></Show>
        <b>{clock(elapsed())}</b>
      </header>
      <Show when={!demo() && bare()}><small class="ui-muted">Not in a dungeon run</small></Show>
      <For each={lines()}>
        {(l) => {
          // A boss that stands is behind only once its time has passed.
          const by = () => (l.best === undefined ? undefined : l.at !== undefined ? l.best - l.at : l.key === next() && elapsed() > l.best ? l.best - elapsed() : undefined);
          return (
            <div class="split" data-done={l.at !== undefined || undefined} data-next={l.key === next() || undefined}>
              <span>{l.name}</span>
              <Show when={by() !== undefined}><em classList={{ ahead: by()! >= 0, behind: by()! < 0 }}>{apart(by()!)}</em></Show>
              <b>{clock(l.at ?? l.best ?? 0)}</b>
            </div>
          );
        }}
      </For>
    </section>
  );
}
