import { createMemo, For, Show } from "solid-js";
import { near } from "../../live/store";
import type { Aura, Unit } from "../../live/types";
import { hideNames, nameStyle, settings } from "../../store";
import { ClassMark, classOf } from "../../ui/classes";
import { short } from "../../ui/format";
import { ticking } from "../../ui/now";
import { buffs, debuffs, effects } from "../effects/logic";
import { Tiles } from "../effects/Tile";
import { power } from "../meter/logic";
import { averagePower, dead, groups, ordered, share, who } from "./logic";
import "./frames.css";

function Frame(props: { of: Unit; name: string; auras: Aura[]; label: string; monster?: boolean }) {
  const now = ticking();
  const part = () => share(props.of);
  return (
    <section class="unit glass" aria-label={props.label} style={{ "--class": props.monster ? "#e0564f" : classOf(props.of.job).color }}>
      <div class="unit-line">
        <Show when={!props.monster}><ClassMark job={props.of.job} /></Show>
        <strong>{props.name}</strong>
        <b class="ui-num">{part() === undefined ? "" : `${(part()! * 100).toFixed(props.monster ? 1 : 0)}%`}</b>
      </div>
      <div class="unit-bar" style={{ "--length": part() ?? 0 }}>
        <i />
        <span class="ui-num">{part() === undefined ? "Not known yet" : `${short(props.of.hp)} / ${short(props.of.maxHp)}`}</span>
      </div>
      <Show when={props.auras.length}><Tiles of={props.auras} now={now()} most={8} small /></Show>
    </section>
  );
}

export const YouOverlay = () => (
  <Show when={near.you}>{(u) => <Frame of={u()} name={u().name || "You"} auras={debuffs(u().auras)} label="Your health" />}</Show>
);

/** Yours first: what you put on it matters most to you. */
export const TargetOverlay = () => (
  <Show when={near.target}>
    {(u) => <Frame of={u()} name={u().name || "Target"} auras={[...u().auras].sort((a, b) => Number(b.yours) - Number(a.yours))} label="Target" monster />}
  </Show>
);

export const FoeOverlay = () => (
  <Show when={near.foe}>
    {(u) => <Frame of={u()} name={who(u(), 0, hideNames())} auras={[...buffs(u().auras), ...debuffs(u().auras)]} label="Target player" />}
  </Show>
);

/** What matters on one of the party: what is bad for them, and what you gave them. */
const shown = (u: Unit) => {
  const all = effects(u, near);
  return [...debuffs(all), ...all.filter((a) => a.yours && !a.bad && a.end > 0)];
};

const health = (u: Unit) => {
  if (dead(u)) return "dead";
  const [part, how] = [share(u), settings.party.health];
  if (part === undefined || how === "off") return "";
  const percent = `${Math.round(part * 100)}%`;
  return how === "percent" ? percent : how === "number" ? short(u.hp) : `${short(u.hp)} ${percent}`;
};

function Member(props: { of: Unit; at: number; now: number }) {
  const set = () => settings.party;
  const tiles = () => <Tiles of={shown(props.of)} now={props.now} most={set().most} small />;
  return (
    <div class="party-cell" data-icons={set().icons}>
      <div
        class="party-row"
        data-dead={dead(props.of) || undefined}
        data-low={(set().low > 0 && (share(props.of) ?? 1) * 100 <= set().low) || undefined}
        style={{ "--class": classOf(props.of.job).color, "--length": share(props.of) ?? 0 }}
      >
        <i />
        <Show when={set().mark}><ClassMark job={props.of.job} /></Show>
        <span data-name={nameStyle(props.of.name)}>{who(props.of, props.at, hideNames())}</span>
        <Show when={set().power && !settings.discreet && props.of.power > 0}><small class="ui-num">{power(props.of.power)}</small></Show>
        <Show when={set().icons === "on"}>{tiles()}</Show>
        <b class="ui-num">{health(props.of)}</b>
      </div>
      <Show when={set().icons === "beside"}>{tiles()}</Show>
    </div>
  );
}

const style = () => ({ "--wide": `${settings.party.width}px`, "--tall": `${settings.party.height}px` });

/** With icons beside, they stand on the side with room. */
export function PartyOverlay() {
  const now = ticking();
  const all = createMemo(() => ordered(near.party, settings.party));
  return (
    <section class="party glass" aria-label="Party frames" style={{ ...style(), "--columns": settings.party.columns }}>
      <For each={all()}>{({ unit, at }) => <Member of={unit} at={at} now={now()} />}</For>
    </section>
  );
}

/** A Force in its groups, side by side. */
export function ForceOverlay() {
  const now = ticking();
  const all = createMemo(() => groups(ordered(near.party, { ...settings.party, order: "game" })));
  return (
    <section class="force" aria-label="Force frames" style={style()}>
      <For each={all()}>
        {(group, i) => (
          <div class="party glass">
            <small class="force-name">Group {i() + 1}</small>
            <For each={group}>{({ unit, at }) => <Member of={unit} at={at} now={now()} />}</For>
          </div>
        )}
      </For>
    </section>
  );
}

/** The party at a glance, as in a dungeon lobby: its average Combat Power, and each one's item level and Combat Power. */
export function CardOverlay() {
  const all = createMemo(() => ordered(near.party, { order: settings.party.order, you: true }));
  return (
    <section class="party-card glass" aria-label="Party card">
      <header>
        <small class="ui-muted">Average Combat Power</small>
        <b class="ui-num">{settings.discreet ? "" : power(averagePower(near.party)) || "Not known"}</b>
      </header>
      <For each={all()}>
        {({ unit, at }) => (
          <div class="party-card-row" style={{ "--class": classOf(unit.job).color }}>
            <ClassMark job={unit.job} />
            <span data-name={nameStyle(unit.name)}>{who(unit, at, hideNames())}</span>
            <small class="ui-num ui-muted">{unit.level > 0 ? `IL ${unit.level}` : ""}</small>
            <b class="ui-num">{!settings.discreet && unit.power > 0 ? power(unit.power) : ""}</b>
          </div>
        )}
      </For>
    </section>
  );
}
