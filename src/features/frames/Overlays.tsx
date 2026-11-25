import { For, Show } from "solid-js";
import { near } from "../../live/store";
import type { Aura, Unit } from "../../live/types";
import { settings } from "../../store";
import { ClassMark, classOf } from "../../ui/classes";
import { short } from "../../ui/format";
import { ticking } from "../../ui/now";
import { buffs, debuffs, effects } from "../effects/logic";
import { Tiles } from "../effects/Tile";
import { dead, share, who } from "./logic";
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
    {(u) => <Frame of={u()} name={who(u(), 0, settings.meter.hideNames)} auras={[...buffs(u().auras), ...debuffs(u().auras)]} label="Target player" />}
  </Show>
);

/** What matters on one of the party: what is bad for them, and what you gave them. */
const shown = (u: Unit) => {
  const all = effects(u, near);
  return [...debuffs(all), ...all.filter((a) => a.yours && !a.bad && a.end > 0)];
};

export function PartyOverlay() {
  const now = ticking();
  return (
    <section class="party glass" aria-label="Party frames">
      <For each={near.party}>
        {(u, i) => (
          <div
            class="party-row"
            data-dead={dead(u) || undefined}
            data-low={(share(u) ?? 1) * 100 <= settings.alerts.ally.value || undefined}
            style={{ "--class": classOf(u.job).color, "--length": share(u) ?? 0 }}
          >
            <i />
            <ClassMark job={u.job} />
            <span>{who(u, i(), settings.meter.hideNames)}</span>
            <Tiles of={shown(u)} now={now()} most={4} small />
            <b class="ui-num">{dead(u) ? "dead" : share(u) === undefined ? "" : `${Math.round(share(u)! * 100)}%`}</b>
          </div>
        )}
      </For>
    </section>
  );
}
