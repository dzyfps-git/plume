import { createEffect, createSignal, on, Show } from "solid-js";
import { grow } from "../features/best/logic";
import { followRival, rival } from "../features/best/rival";
import { Chart } from "../features/history/Chart";
import { fight } from "../live/store";
import "../features/history/history.css";

/** Your damage over the fight as it goes, with your best kill behind it. */
export function Curve() {
  followRival();
  const [curve, setCurve] = createSignal<{ target: number; mine: number[] }>({ target: 0, mine: [] });
  const second = () => `${fight.target.code} ${Math.floor(fight.ms / 1000)}`;
  createEffect(on(second, () => {
    const own = fight.rows.find((r) => r.you)?.damage ?? 0;
    const target = fight.target.code;
    setCurve((was) => ({ target, mine: grow(was.target === target ? was.mine : [], fight.ms, own) }));
  }));
  return (
    <Show when={fight.rows.length > 0 && curve().mine.length > 1} fallback={<p class="ui-muted ui-small">Nothing right now.</p>}>
      <Chart curve={curve().mine} best={rival()?.curve} other="your best kill" />
    </Show>
  );
}
