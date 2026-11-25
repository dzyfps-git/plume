import { createMemo, Show } from "solid-js";
import { clock, short } from "../../ui/format";
import { pace, path } from "./logic";

const [WIDTH, HEIGHT] = [600, 120];

/** Your damage a second over a fight, with your best drawn behind it. */
export function Chart(props: { curve: readonly number[]; best?: readonly number[] }) {
  const mine = createMemo(() => pace(props.curve));
  const best = createMemo(() => pace(props.best ?? []));
  const most = createMemo(() => Math.max(1, ...mine(), ...best()) * 1.08);
  const count = createMemo(() => Math.max(mine().length, best().length));
  const line = (values: number[]) => path(values, WIDTH, HEIGHT, most(), count());
  return (
    <Show when={props.curve.length > 1}>
      <figure class="chart">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Your damage a second over the fight">
          <path class="chart-fill" d={`${line(mine())}V${HEIGHT}H0Z`} />
          <path class="chart-best" d={line(best())} />
          <path class="chart-mine" d={line(mine())} />
        </svg>
        <figcaption class="ui-num">
          <span>0:00</span>
          <span>highest {short(Math.max(...mine()))} a second</span>
          <Show when={best().length}>
            <span class="chart-key">dashed line: your best</span>
          </Show>
          <span>{clock((count() - 1) * 1000)}</span>
        </figcaption>
      </figure>
    </Show>
  );
}
