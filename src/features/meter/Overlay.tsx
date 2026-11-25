import { createEffect, createMemo, For, on, Show } from "solid-js";
import { entries, fight, near } from "../../live/store";
import type { Row } from "../../live/types";
import { settings } from "../../store";
import { barEase } from "../../store/settings";
import { ClassMark, classOf } from "../../ui/classes";
import { clock, short } from "../../ui/format";
import { Drawn, PingBars, Thing } from "../../ui/icons";
import { BossBar } from "../boss/Bar";
import { followFights, fights } from "../history/store";
import { strip } from "../resources/logic";
import { against, BEST, bestRow, footer, label, partyDps, power, ranked, shown, signed, VIEW_NAMES, withBest, type Against, type Foot, type Ranked } from "./logic";
import "./meter.css";

const rateText = (rate: number) => (settings.meter.view === "hits" ? rate.toFixed(1) : short(rate));

/** One compact piece: the target with its health, the bars, and a line with what you chose under them. */
export function MeterOverlay() {
  followFights();
  const view = () => settings.meter.view;
  const cards = () => settings.meter.style === "cards";
  const you = () => fight.rows.find((r) => r.you);
  const held = createMemo(() => (settings.meter.head || settings.meter.ghost ? against(fight, fights()) : undefined));
  const best = () => (settings.meter.ghost && view() === "damage" && you() ? held()?.best : undefined);
  const all = createMemo(() => withBest(ranked(fight, view()), best(), fight.ms, you()?.job ?? ""));
  // Your own card stands by itself.
  const list = createMemo(() => shown(all(), settings.meter.rows).filter(({ row }) => !(cards() && row.you)));
  const spots = createMemo(() => new Map(list().map((r, spot) => [r.row.id, { ...r, spot }])));
  const most = () => Math.max(1, all()[0]?.total ?? 0);
  const sum = () => (view() === "damage" || view().endsWith("dps") ? partyDps(fight) : all().reduce((n, r) => n + r.rate, 0));
  // In one fixed order: a row moved in the page would jump instead of glide.
  const still = createMemo(() => [...fight.rows].sort((a, b) => a.id - b.id));
  const foot = createMemo(() => footer(settings.meter.footer, near, fight, entries(), strip(entries(), near.odyle, settings.resources, settings.odyleRun), settings.odyleRun));
  const title = () => (view() === "damage" ? fight.target.name || VIEW_NAMES.damage : VIEW_NAMES[view()]);
  const pull = () => <Show when={settings.meter.head && !cards() && held()}>{(h) => <Pull of={h()} />}</Show>;
  const line = (row: Row) => <Show when={spots().get(row.id)}>{(at) => <MeterRow row={row} at={at()} most={most()} many={all().length > 1} />}</Show>;
  return (
    <section class="meter" classList={{ glass: settings.meter.style === "bar" || settings.meter.style === "table" }} data-style={settings.meter.style} aria-label="Damage meter">
      <Show
        when={settings.meter.boss && fight.target.maxHp > 0}
        fallback={
          <header class="meter-head">
            <strong>{title()}</strong>
            {pull()}
            <span class="ui-num">{clock(fight.ms)}</span>
            <b class="ui-num">{view() === "hits" ? sum().toFixed(1) : short(sum())}</b>
          </header>
        }
      >
        <header class="meter-boss">
          <BossBar title={title()} beside={pull()}>
            <span class="ui-num">{clock(fight.ms)}</span>
            <b class="ui-num">{view() === "hits" ? sum().toFixed(1) : short(sum())}</b>
          </BossBar>
        </header>
      </Show>
      <Show when={cards() && all().find(({ row }) => row.you)}>{(at) => <Hero at={at()} first={fight.rows.length > 1 && ranked(fight, view())[0]?.row.you} held={settings.meter.head ? held() : undefined} />}</Show>
      <Show when={list().length}>
        <div class="meter-rows" style={{ "--count": list().length }}>
          <For each={still()}>{line}</For>
          {line(bestRow)}
        </div>
      </Show>
      <Show when={foot().length}>
        <footer class="meter-foot ui-num">
          <For each={foot()}>{(f) => <FootItem of={f} />}</For>
        </footer>
      </Show>
    </section>
  );
}

function MeterRow(props: { row: Row; at: Ranked & { rank: number; spot: number }; most: number; many: boolean }) {
  let shine!: HTMLElement;
  // Light runs over a row that overtakes another.
  createEffect(on(() => props.at.spot, (now, before) => {
    if (before === undefined || now >= before || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    shine.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(100%)" }], { duration: 700, easing: barEase(settings.fps, 700) });
  }));
  const ghost = () => props.row.id === BEST;
  const job = () => props.at.row.job;
  return (
    <div
      class="meter-row"
      data-you={props.row.you || undefined}
      data-ghost={ghost() || undefined}
      style={{ "--class": classOf(job()).color, "--spot": props.at.spot, "--length": props.at.total / props.most }}
    >
      <i class="meter-bar" />
      <i class="meter-shine" ref={shine} />
      <span class="meter-rank ui-num" data-rank={props.at.rank}>{props.at.rank || ""}</span>
      <Show when={settings.meter.icons}>
        <ClassMark job={job()} />
      </Show>
      <span class="meter-name">
        <span>{ghost() ? "Your best" : label(props.row, settings.meter.hideNames, props.at.rank)}</span>
        <Show when={props.at.rank === 1 && props.many && settings.meter.view === "damage"}><Drawn name="crown" /></Show>
        <Show when={settings.meter.power && props.row.power > 0}><small class="meter-power ui-num"><Thing of="power" />{power(props.row.power)}</small></Show>
      </span>
      <Show when={props.row.deaths > 0}>
        <small class="meter-deaths" aria-label={`Died ${props.row.deaths} times`}>✕{props.row.deaths > 1 ? props.row.deaths : ""}</small>
      </Show>
      <Show when={settings.meter.total}>
        <small class="ui-num">{short(props.at.total)}</small>
      </Show>
      <Show when={settings.meter.share && !ghost()}>
        <small class="ui-num meter-share">{props.at.share.toFixed(1)}%</small>
      </Show>
      <b class="ui-num">{rateText(props.at.rate)}</b>
    </div>
  );
}

/** You, large, on a card of your own. */
function Hero(props: { at: Ranked; first: boolean; held?: Against }) {
  const row = () => props.at.row;
  return (
    <div class="meter-hero" style={{ "--class": classOf(row().job).color }}>
      <ClassMark job={row().job} />
      <span class="meter-name">
        <span>{row().name || "You"} <Show when={props.first && settings.meter.view === "damage"}><Drawn name="crown" /></Show></span>
        <Show when={settings.meter.power && row().power > 0}><small class="meter-power ui-num"><Thing of="power" />{power(row().power)}</small></Show>
      </span>
      <span class="hero-rate">
        <b class="ui-num">{rateText(props.at.rate)}</b>
        <Show when={props.held} fallback={<small class="ui-num">{props.at.share.toFixed(1)}%</small>}>{(h) => <Pull of={h()} />}</Show>
      </span>
    </div>
  );
}

/** Which try this is, and how it goes against your best. */
const Pull = (props: { of: Against }) => (
  <small class="meter-pull ui-num">
    {fight.mode === "trainTargets" ? "run" : "pull"} {props.of.pull}
    <Show when={props.of.change !== undefined}><em style={{ color: props.of.change! >= 0 ? "var(--success-ink)" : "var(--danger-ink)" }}>{signed(props.of.change!)}</em></Show>
  </small>
);

const FootItem = (props: { of: Foot }) => (
  <span class="foot-item" aria-label={props.of.name}>
    <Show when={props.of.icon === "ping"}><PingBars ping={near.ping} /></Show>
    <Show when={props.of.icon === "flight"}><Drawn name="wing" /></Show>
    <Show when={props.of.thing}>{(thing) => <Thing of={thing()} />}</Show>
    <Show when={!props.of.icon && !props.of.thing}><small>{props.of.name}</small></Show>
    <b>{props.of.value}</b>
    <Show when={props.of.bonus}><span class="bonus">{props.of.bonus}</span></Show>
    <Show when={props.of.more}><small>{props.of.more}</small></Show>
  </span>
);
