import { createContext, createEffect, createMemo, For, on, Show, useContext } from "solid-js";
import { fight, near, over, sampling, skills } from "../../live/store";
import type { Row } from "../../live/types";
import { hideNames, nameStyle, settings } from "../../store";
import { barEase, type Footer, type Meter } from "../../store/settings";
import { ClassMark, classOf } from "../../ui/classes";
import { clock, full, percent, short } from "../../ui/format";
import { Drawn, Thing } from "../../ui/icons";
import { ticking } from "../../ui/now";
import { Pic } from "../../ui/Pic";
import { BossBar } from "../boss/Bar";
import { hp } from "../boss/logic";
import { followFights, fights } from "../history/store";
import { Buttons } from "./Buttons";
import { Feet } from "./Foot";
import { bursting, casts, fallen, peek } from "./live";
import { against, BEST, whose, bestRow, gap, label, lines, partyDps, power, ranked, shown, signed, VIEW_NAMES, withBest, type Against, type Ranked } from "./logic";
import "./meter.css";

/** How this one looks: yours, or one to choose from. */
const Look = createContext<() => Meter>(() => settings.meter);
const look = () => useContext(Look)();

/** Nothing to show but what stays on screen out of fights. */
export const bare = () => !fight.rows.length && !settings.meter.compact && !settings.meter.small && !settings.meter.always;

/** One compact piece: the target with its health, the bars, and a line with what you chose under them. */
export function MeterOverlay(props: { look?: Partial<Meter> }) {
  followFights();
  const still = !!props.look;
  const m = createMemo<Meter>(() => ({ ...settings.meter, ...props.look, ...(peek() && !still && PEEKED) }));
  const gone = () => !still && !sampling() && over() && settings.fights.after === "clear";
  const small = () => (still ? !!props.look!.small : !peek() && !sampling() && (m().small || (m().compact && (over() || !fight.rows.length))));
  const bar = () => m().style === "bar" || m().style === "table" || m().style === "gauge";
  return (
    <Look.Provider value={m}>
      <section
        class="meter"
        classList={{ glass: small() || bar() }}
        data-style={m().style}
        data-small={small() || undefined}
        data-look={settings.look.theme}
        data-theme={settings.look.theme === "light" ? "light" : undefined}
        data-font={settings.look.font}
        data-outline={settings.look.outline || undefined}
        data-thin={settings.look.thin || undefined}
        data-locked={m().locked || undefined}
        data-strong={(settings.look.strong && m().locked) || undefined}
        data-touch={!still && !m().locked ? "" : undefined}
        style={{
          "--high": `${settings.look.height}px`, "--size": settings.look.size, "--shade": m().locked ? settings.look.shade : 0, "--back": settings.look.mark,
          ...(settings.look.background && { "--surface-base": settings.look.background, "--surface-raised": settings.look.background }),
        }}
        aria-label="Damage meter"
      >
        <Show when={small()} fallback={<Whole gone={gone()} still={still} />}><Small gone={gone()} still={still} /></Show>
      </section>
    </Look.Provider>
  );
}

/** What a closer look shows, whatever is chosen. */
const PEEKED: Partial<Meter> = { rows: 24, left: "total", right: "share", small: false, compact: false, gap: true };

const footers = () => {
  const { footer } = look();
  // Odyle Energy and the entries stand where you want them.
  const entry: Footer[] = footer.filter((f) => f === "odyle" || f === "entries");
  const { place } = settings.odyle;
  return { top: place === "top" ? entry : [], bottom: place === "bottom" ? footer : footer.filter((f) => !entry.includes(f)) };
};

/** A row for you while there is no fight. */
const alone = (): Row | undefined => (near.you ? { ...bestRow, id: near.you.id, name: near.you.name, job: near.you.job, you: true, power: near.you.power, level: near.you.level } : undefined);

function Whole(props: { gone: boolean; still: boolean }) {
  const m = look;
  const view = () => m().view;
  const cards = () => m().style === "cards";
  const lone = () => (m().always && alone() ? [alone()!] : []);
  const rows = () => (props.gone ? lone() : fight.rows.length ? whose(fight.rows, m().who, new Set(near.party.map((u) => u.id))) : lone());
  const you = () => rows().find((r) => r.you);
  const held = createMemo(() => (m().head || m().ghost ? against(fight, fights()) : undefined));
  const best = () => (m().ghost && view() === "damage" && you() ? held()?.best : undefined);
  const all = createMemo(() => withBest(ranked({ rows: rows(), ms: fight.ms }, view()), best(), fight.ms, you()?.job ?? ""));
  // Your own card stands by itself.
  const list = createMemo(() => shown(all(), m().rows, m().top).filter(({ row }) => !(cards() && row.you)));
  const yours = () => list().findIndex(({ row }) => row.you);
  const strip = () => m().casts && casts().length > 0 && !!you();
  const spots = createMemo(() => new Map(list().map((r, spot) => [r.row.id, { ...r, spot, after: strip() && !cards() && spot > yours() }])));
  const most = () => Math.max(1, ...all().map((r) => r.total));
  const sum = () => (view() === "damage" || view().endsWith("dps") ? (props.gone ? 0 : partyDps(fight)) : all().reduce((n, r) => n + r.rate, 0));
  // In one fixed order: a row moved in the page would jump instead of glide.
  const still = createMemo(() => [...rows()].sort((a, b) => a.id - b.id));
  const title = () => (props.gone ? "Ready" : view() === "damage" ? fight.target.name || VIEW_NAMES.damage : VIEW_NAMES[view()]);
  const pull = () => <Show when={m().head && !cards() && !props.gone && held()}>{(h) => <Pull of={h()} />}</Show>;
  const line = (row: Row) => <Show when={spots().get(row.id)}>{(at) => <MeterRow row={row} at={at()} most={most()} many={all().length > 1} gap={row.you && m().gap ? gap(all()) : undefined} />}</Show>;
  const feet = createMemo(footers);
  const figures = () => (
    <>
      <Show when={m().clock && !props.gone}><span class="ui-num">{clock(fight.ms)}</span></Show>
      <b class="ui-num">{view() === "hits" ? sum().toFixed(1) : number(sum())}</b>
    </>
  );
  return (
    <>
      <Show when={!props.still}><Buttons /></Show>
      <Show
        when={m().boss && !props.gone && fight.target.maxHp > 0}
        fallback={
          <header class="meter-head">
            <strong>{title()}</strong>
            {pull()}
            {figures()}
          </header>
        }
      >
        <header class="meter-boss">
          <BossBar title={title()} beside={pull()}>{figures()}</BossBar>
        </header>
      </Show>
      <Feet of={feet().top} class="meter-foot meter-top" />
      <Show when={cards() && all().find(({ row }) => row.you)}>
        {(at) => <Hero at={at()} first={rows().length > 1 && ranked({ rows: rows(), ms: fight.ms }, view())[0]?.row.you} held={m().head ? held() : undefined} gap={m().gap ? gap(all()) : undefined} />}
      </Show>
      <Show when={list().length}>
        <div class="meter-rows" style={{ "--count": list().length, "--more": strip() ? 1 : 0, "--yours": cards() ? list().length - 1 : yours() }}>
          <For each={still()}>{line}</For>
          {line(bestRow)}
          <Show when={strip()}>
            <div class="meter-casts" role="img" aria-label="Your last casts">
              <For each={casts()}>{(c) => <Pic skill={c.skill} name={c.name || "Skill"} />}</For>
            </div>
          </Show>
        </div>
      </Show>
      <Show when={peek() && !props.still}><Details /></Show>
      <Show when={!m().locked || m().footerLocked}><Feet of={feet().bottom} class="meter-foot" /></Show>
    </>
  );
}

/** One bar: you, what you chose, and the buttons. */
function Small(props: { gone: boolean; still: boolean }) {
  const m = look;
  const mine = createMemo(() => (props.gone ? undefined : ranked(fight, m().view).find(({ row }) => row.you)));
  const row = () => mine()?.row ?? alone();
  return (
    <div class="meter-small">
      <Show when={row()} fallback={<strong class="meter-name"><span>Plume</span></strong>}>
        {(r) => (
          <>
            <ClassMark job={r().job} />
            <span class="meter-name">
              <span>{label(r(), hideNames(), 1)}</span>
              <Corner of={r()} />
            </span>
          </>
        )}
      </Show>
      <Show when={!over() && fight.target.maxHp > 0}><small class="ui-num">{percent(hp(fight), fight.target.maxHp)}</small></Show>
      <Show when={mine()}>{(at) => <b class="ui-num" data-over={over() || undefined}>{rateText(at().rate)}</b>}</Show>
      <Feet of={m().footerSmall} class="small-feet" />
      <Show when={!props.still}><Buttons /></Show>
    </div>
  );
}

const number = (n: number) => (settings.meter.full ? full(Math.round(n)) : short(n));
const rateText = (rate: number) => (settings.meter.view === "hits" ? rate.toFixed(1) : number(rate));

/** Combat Power or the item level, small. */
function Corner(props: { of: Pick<Row, "you" | "power" | "level"> }) {
  const m = look;
  const on = () => !settings.discreet && (props.of.you || m().corners === "all");
  return (
    <>
      <Show when={on() && m().corner === "power" && props.of.power > 0}><small class="meter-power ui-num"><Thing of="power" />{power(props.of.power)}</small></Show>
      <Show when={on() && m().corner === "level" && props.of.level > 0}><small class="meter-power ui-num">IL {full(props.of.level)}</small></Show>
    </>
  );
}

function MeterRow(props: { row: Row; at: Ranked & { rank: number; spot: number; after: boolean }; most: number; many: boolean; gap?: number }) {
  const m = look;
  let shine!: HTMLElement;
  // Light runs over a row that overtakes another.
  createEffect(on(() => props.at.spot, (now, before) => {
    if (before === undefined || now >= before || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    shine.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(100%)" }], { duration: 700, easing: barEase(settings.fps, 700) });
  }));
  const ghost = () => props.row.id === BEST;
  const job = () => props.at.row.job;
  const died = () => (m().dead ? fallen().get(props.row.id) : undefined);
  const part = () => (m().buffShare && m().view === "damage" && props.row.got > 0 && props.row.damage > 0 ? Math.min(1, props.row.got / props.row.damage) : 0);
  const side = (what: Meter["left"]) => (
    <Show when={what && !(ghost() && what === "share")}>
      <small class="ui-num" classList={{ "meter-share": what === "share" }}>{what === "total" ? number(props.at.total) : `${props.at.share.toFixed(1)}%`}</small>
    </Show>
  );
  return (
    <div
      class="meter-row"
      data-you={props.row.you || undefined}
      data-ghost={ghost() || undefined}
      data-after={props.at.after || undefined}
      data-burst={(m().burst && bursting().has(props.row.id)) || undefined}
      data-dead={died() !== undefined || undefined}
      style={{ "--class": classOf(job()).color, "--spot": props.at.spot, "--length": props.at.total / props.most, "--got": part() }}
    >
      <i class="meter-bar" />
      <Show when={part() > 0}><i class="meter-got" /></Show>
      <i class="meter-shine" ref={shine} />
      <Show when={settings.look.mark > 0}><span class="meter-back"><ClassMark job={job()} /></span></Show>
      <span class="meter-rank ui-num" data-rank={props.at.rank}>{props.at.rank || ""}</span>
      <Show when={m().icons || m().style === "gauge"}>
        <span class="meter-ring"><ClassMark job={job()} /></span>
      </Show>
      <span class="meter-name">
        <span data-name={ghost() ? undefined : nameStyle(props.row.name)}>{ghost() ? "Your best" : label(props.row, hideNames(), props.at.rank)}</span>
        <Show when={props.at.rank === 1 && props.many && m().view === "damage"}><Drawn name="crown" /></Show>
        <Corner of={props.row} />
      </span>
      <Show when={died()} keyed>{(at) => <Down since={at} />}</Show>
      <Show when={props.row.deaths > 0 && died() === undefined}>
        <small class="meter-deaths" aria-label={`Died ${props.row.deaths} times`}>✕{props.row.deaths > 1 ? props.row.deaths : ""}</small>
      </Show>
      <Show when={props.gap !== undefined}><small class="meter-gap ui-num" aria-label="To the next place">-{short(props.gap!)}</small></Show>
      {side(m().left)}
      <b class="ui-num">{rateText(props.at.rate)}</b>
      {side(m().right)}
    </div>
  );
}

/** How long someone has been down. */
function Down(props: { since: number }) {
  const now = ticking();
  return <small class="meter-deaths ui-num">{clock(now() - props.since)}</small>;
}

/** You, large, on a card of your own. */
function Hero(props: { at: Ranked; first: boolean; held?: Against; gap?: number }) {
  const row = () => props.at.row;
  const m = look;
  return (
    <div class="meter-hero" style={{ "--class": classOf(row().job).color }} data-dead={(m().dead && fallen().has(row().id)) || undefined} data-burst={(m().burst && bursting().has(row().id)) || undefined}>
      <ClassMark job={row().job} />
      <span class="meter-name">
        <span data-name={nameStyle(row().name)}>{label(row(), hideNames(), 1)} <Show when={props.first && m().view === "damage"}><Drawn name="crown" /></Show></span>
        <Corner of={row()} />
      </span>
      <span class="hero-rate">
        <b class="ui-num">{rateText(props.at.rate)}</b>
        <span>
          <Show when={props.gap !== undefined}><small class="meter-gap ui-num" aria-label="To the next place">-{short(props.gap!)}</small> </Show>
          <Show when={props.held} fallback={<small class="ui-num">{props.at.share.toFixed(1)}%</small>}>{(h) => <Pull of={h()} />}</Show>
        </span>
      </span>
    </div>
  );
}

/** A closer look at your own fight. */
function Details() {
  const mine = () => fight.rows.find((r) => r.you);
  const list = createMemo(() => (skills().id === mine()?.id ? lines(skills().skills).slice(0, 6) : []));
  const part = (n: number) => percent(n, fight.own[0]);
  const facts = () => {
    const r = mine();
    return r
      ? [["Total", full(r.damage)], ["Crit", part(fight.own[1])], ["Back", part(fight.own[2])], ["Hits", full(r.hits)], ["Taken", short(r.taken)], ["Healing", short(r.healing)]]
      : [];
  };
  return (
    <div class="meter-peek ui-num" style={{ "--class": classOf(mine()?.job ?? "").color }}>
      <div class="peek-facts"><For each={facts()}>{([name, value]) => <span><small>{name}</small><b>{value}</b></span>}</For></div>
      <For each={list()}>
        {(s) => (
          <div class="peek-skill" style={{ "--length": s.damage / Math.max(1, list()[0].damage) }}>
            <i />
            <Pic skill={s.code} name={s.name || "Skill"} />
            <span>{s.name || `Skill ${s.code}`}</span>
            <small>{percent(s.share, 1)}</small>
            <b>{short(s.damage)}</b>
          </div>
        )}
      </For>
    </div>
  );
}

/** Which try this is, and how it goes against your best. */
const Pull = (props: { of: Against }) => (
  <small class="meter-pull ui-num">
    {fight.mode === "trainTargets" ? "run" : "pull"} {props.of.pull}
    <Show when={props.of.change !== undefined}><em style={{ color: props.of.change! >= 0 ? "var(--tone-ready)" : "var(--tone-danger)" }}>{signed(props.of.change!)}</em></Show>
  </small>
);
