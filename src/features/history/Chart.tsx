import { createMemo, For, Show } from "solid-js";
import { clock, short } from "../../ui/format";
import { pace, path } from "./logic";

const [WIDTH, HEIGHT] = [600, 120];

export interface DeathMark {
  ms: number;
  who: string;
  you: boolean;
}

/** Your damage a second over a fight, with your best or another drawn behind it, the party's, and who died when. */
export function Chart(props: { curve: readonly number[]; best?: readonly number[]; other?: string; party?: readonly number[]; deaths?: readonly DeathMark[] }) {
  const mine = createMemo(() => pace(props.curve));
  const best = createMemo(() => pace(props.best ?? []));
  const party = createMemo(() => pace(props.party ?? []));
  const most = createMemo(() => Math.max(1, ...mine(), ...best(), ...party()) * 1.08);
  const count = createMemo(() => Math.max(mine().length, best().length));
  const line = (values: number[]) => path(values, WIDTH, HEIGHT, most(), count());
  return (
    <Show when={props.curve.length > 1}>
      <figure class="chart">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Your damage a second over the fight">
          <path class="chart-fill" d={`${line(mine())}V${HEIGHT}H0Z`} />
          <path class="chart-party" d={line(party())} />
          <path class="chart-best" d={line(best())} />
          <path class="chart-mine" d={line(mine())} />
        </svg>
        <For each={props.deaths}>
          {(d) => (
            <i class="chart-death" data-you={d.you || undefined} data-tip={`${d.who} died at ${clock(d.ms)}`} style={{ left: `${Math.min(100, (d.ms / 1000 / Math.max(1, count() - 1)) * 100)}%` }} />
          )}
        </For>
        <figcaption class="ui-num">
          <span>0:00</span>
          <span>highest {short(Math.max(...mine()))} a second</span>
          <Show when={party().length}><span>thin line: the party</span></Show>
          <Show when={best().length}>
            <span class="chart-key">dashed line: {props.other ?? "your best"}</span>
          </Show>
          <span>{clock((count() - 1) * 1000)}</span>
        </figcaption>
      </figure>
    </Show>
  );
}
