import { For, Show, type JSX } from "solid-js";
import { clock } from "../../ui/format";
import { Pic } from "../../ui/Pic";
import type { Pictured } from "../../ui/pictures";

export interface Mark {
  from: number;
  /** The same as `from` for a moment. */
  to: number;
  /** Shown when pointed at. */
  tip?: string;
  /** Fainter, or brighter. */
  weight?: number;
}
export interface Lane {
  name: string;
  /** What its picture is of. */
  of?: Pictured;
  /** At the end of the lane. */
  note?: JSX.Element;
  color?: string;
  marks: Mark[];
}

/** Rows of spans over one span of time, all to the same scale. */
export function Lanes(props: { lanes: Lane[]; ms: number; label: string; axis?: boolean; zoom?: number }) {
  const at = (t: number) => `${(Math.min(Math.max(t, 0), props.ms) / Math.max(1, props.ms)) * 100}%`;
  return (
    <div class="lanes" role="table" aria-label={props.label} data-zoom={(props.zoom ?? 1) > 1 || undefined} style={{ "--zoom": props.zoom ?? 1 }}>
      <For each={props.lanes}>
        {(lane) => (
          <div class="lane" role="row" style={{ "--lane": lane.color ?? "var(--accent)" }}>
            <span class="lane-name" role="rowheader"><Show when={lane.of}>{(of) => <Pic {...of()} name={lane.name} />}</Show>{lane.name}</span>
            <span class="lane-track" role="cell">
              <For each={lane.marks}>
                {(m) => (
                  <i
                    data-tip={m.tip}
                    data-moment={m.to <= m.from || undefined}
                    style={{ left: at(m.from), width: m.to > m.from ? `calc(${at(m.to)} - ${at(m.from)})` : undefined, opacity: m.weight }}
                  />
                )}
              </For>
            </span>
            <span class="lane-note ui-num" role="cell">{lane.note}</span>
          </div>
        )}
      </For>
      <Show when={props.axis !== false}>
        <div class="lane lane-axis ui-num" aria-hidden="true">
          <span />
          <span class="lane-track">
            <For each={Array.from({ length: 4 * (props.zoom ?? 1) + 1 }, (_, i, all = 4 * (props.zoom ?? 1)) => i / all)}>{(part) => <span style={{ left: `${part * 100}%` }}>{clock(props.ms * part)}</span>}</For>
          </span>
        </div>
      </Show>
    </div>
  );
}
