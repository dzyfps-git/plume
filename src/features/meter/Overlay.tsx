import { createMemo, For, Show } from "solid-js";
import { fight } from "../../live/store";
import { settings } from "../../store";
import { ClassMark, classOf } from "../../ui/classes";
import { clock, short } from "../../ui/format";
import { label, length, partyDps, shown } from "./logic";
import "./meter.css";

/** One compact piece: the target, the clock and the party's damage in the header, then the bars. */
export function MeterOverlay() {
  const list = createMemo(() => shown(fight.rows, settings.meter.rows));
  const spots = createMemo(() => new Map(list().map(({ row, rank }, spot) => [row.id, { rank, spot }])));
  // In one fixed order: a row moved in the page would jump instead of glide.
  const still = createMemo(() => [...fight.rows].sort((a, b) => a.id - b.id));
  return (
    <section class="meter glass" data-style={settings.meter.style} aria-label="Damage meter">
      <header class="meter-head">
        <strong>{fight.target.name || "Damage"}</strong>
        <span class="ui-num">{clock(fight.ms)}</span>
        <b class="ui-num">{short(partyDps(fight))}</b>
      </header>
      <div class="meter-rows" style={{ "--count": list().length }}>
        <For each={still()}>
          {(row) => (
            <Show when={spots().get(row.id)}>
              {(at) => (
                <div
                  class="meter-row"
                  data-you={row.you || undefined}
                  style={{ "--class": classOf(row.job).color, "--spot": at().spot, "--length": length(row, fight.rows) }}
                >
                  <i class="meter-bar" />
                  <Show when={settings.meter.icons}>
                    <ClassMark job={row.job} />
                  </Show>
                  <span class="meter-name">{label(row, settings.meter.hideNames, at().rank)}</span>
                  <Show when={row.deaths > 0}>
                    <small class="meter-deaths" aria-label={`Died ${row.deaths} times`}>✕{row.deaths > 1 ? row.deaths : ""}</small>
                  </Show>
                  <Show when={settings.meter.total}>
                    <small class="ui-num">{short(row.damage)}</small>
                  </Show>
                  <Show when={settings.meter.share}>
                    <small class="ui-num meter-share">{row.share.toFixed(1)}%</small>
                  </Show>
                  <b class="ui-num">{short(row.dps)}</b>
                </div>
              )}
            </Show>
          )}
        </For>
      </div>
    </section>
  );
}
