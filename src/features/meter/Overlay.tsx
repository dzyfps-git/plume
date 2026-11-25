import { createMemo, For, Show } from "solid-js";
import { entries, fight, near } from "../../live/store";
import { settings } from "../../store";
import { ClassMark, classOf } from "../../ui/classes";
import { clock, short } from "../../ui/format";
import { followFights, fights } from "../history/store";
import { strip, words } from "../resources/logic";
import { against, footer, label, partyDps, power, ranked, shown, signed, VIEW_NAMES } from "./logic";
import "./meter.css";

/** One compact piece: the target, the clock and the party's damage in the header, then the bars. */
export function MeterOverlay() {
  const view = () => settings.meter.view;
  const all = createMemo(() => ranked(fight, view()));
  const list = createMemo(() => shown(all(), settings.meter.rows));
  const spots = createMemo(() => new Map(list().map((r, spot) => [r.row.id, { ...r, spot }])));
  const most = () => Math.max(1, all()[0]?.total ?? 0);
  const sum = () => (view() === "damage" || view().endsWith("dps") ? partyDps(fight) : all().reduce((n, r) => n + r.rate, 0));
  // In one fixed order: a row moved in the page would jump instead of glide.
  const still = createMemo(() => [...fight.rows].sort((a, b) => a.id - b.id));
  const foot = createMemo(() => footer(settings.meter.footer, near, fight, words(strip(entries(), near.odyle, settings.resources))));
  return (
    <section class="meter glass" data-style={settings.meter.style} aria-label="Damage meter">
      <Show when={settings.meter.head}><You /></Show>
      <header class="meter-head">
        <strong>{view() === "damage" ? fight.target.name || VIEW_NAMES.damage : VIEW_NAMES[view()]}</strong>
        <span class="ui-num">{clock(fight.ms)}</span>
        <b class="ui-num">{view() === "hits" ? sum().toFixed(1) : short(sum())}</b>
      </header>
      <div class="meter-rows" style={{ "--count": list().length }}>
        <For each={still()}>
          {(row) => (
            <Show when={spots().get(row.id)}>
              {(at) => (
                <div
                  class="meter-row"
                  data-you={row.you || undefined}
                  style={{ "--class": classOf(row.job).color, "--spot": at().spot, "--length": at().total / most() }}
                >
                  <i class="meter-bar" />
                  <Show when={settings.meter.icons}>
                    <ClassMark job={row.job} />
                  </Show>
                  <span class="meter-name">{label(row, settings.meter.hideNames, at().rank)}<Show when={settings.meter.power && row.power > 0}><small class="meter-power ui-num">{power(row.power)}</small></Show></span>
                  <Show when={row.deaths > 0}>
                    <small class="meter-deaths" aria-label={`Died ${row.deaths} times`}>✕{row.deaths > 1 ? row.deaths : ""}</small>
                  </Show>
                  <Show when={settings.meter.total}>
                    <small class="ui-num">{short(at().total)}</small>
                  </Show>
                  <Show when={settings.meter.share}>
                    <small class="ui-num meter-share">{at().share.toFixed(1)}%</small>
                  </Show>
                  <b class="ui-num">{view() === "hits" ? at().rate.toFixed(1) : short(at().rate)}</b>
                </div>
              )}
            </Show>
          )}
        </For>
      </div>
      <Show when={foot().length}>
        <footer class="meter-foot ui-num">
          <For each={foot()}>{(words) => <span>{words}</span>}</For>
        </footer>
      </Show>
    </section>
  );
}

/** You: class, Combat Power, which try this is and how it goes against your best. */
function You() {
  followFights();
  const you = () => fight.rows.find((r) => r.you);
  const held = createMemo(() => against(fight, fights()));
  const tone = () => ((held()?.change ?? 0) >= 0 ? "var(--success-ink)" : "var(--danger-ink)");
  return (
    <Show when={you()}>
      {(row) => (
        <div class="meter-you" style={{ "--class": classOf(row().job).color }}>
          <ClassMark job={row().job} />
          <b>{row().name || "You"}</b>
          <Show when={row().power > 0}><small class="ui-num">{power(row().power)} CP</small></Show>
          <span class="ui-num">
            {fight.mode === "trainTargets" ? "run" : "pull"} {held()?.pull ?? 1}
            <Show when={held()?.change !== undefined}><em style={{ color: tone() }}>{signed(held()!.change!)} on best</em></Show>
          </span>
        </div>
      )}
    </Show>
  );
}
