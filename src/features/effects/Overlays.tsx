import { createMemo, For, Show } from "solid-js";
import { near } from "../../live/store";
import { settings } from "../../store";
import { ticking } from "../../ui/now";
import { who } from "../frames/logic";
import { buffs, called, chosenName, CONTROL, debuffs, effects, held, left, missing, remaining } from "./logic";
import { Tiles } from "./Tile";

const mine = () => near.you?.auras ?? [];
export const yourBuffs = () => buffs(mine());
export const yourDebuffs = () => debuffs(mine());
export const holds = () => held(mine());
export const lacks = () => missing(settings.ready, near);
export const sick = () => near.party.filter((unit) => effects(unit, near).some((a) => a.bad));

export function BuffsOverlay() {
  const now = ticking();
  const list = createMemo(yourBuffs);
  return <section class="strip glass" aria-label="Your buffs"><Tiles of={list()} now={now()} most={24} /></section>;
}

export function DebuffsOverlay() {
  const now = ticking();
  const list = createMemo(yourDebuffs);
  return <section class="strip glass" aria-label="Your debuffs"><Tiles of={list()} now={now()} most={16} /></section>;
}

export function PartyDebuffsOverlay() {
  const now = ticking();
  return (
    <section class="sick glass" aria-label="Party debuffs">
      <For each={sick()}>
        {(unit) => (
          <div>
            <span>{who(unit, near.party.indexOf(unit), settings.meter.hideNames)}</span>
            <Tiles of={debuffs(effects(unit, near))} now={now()} most={6} small />
          </div>
        )}
      </For>
    </section>
  );
}

export function ControlOverlay() {
  const now = ticking();
  return (
    <section class="held glass" aria-label="Loss of control">
      <Show when={holds()} fallback={<><b>Stunned</b><span>Loss of control</span></>}>
        {(a) => (
          <>
            <b>{CONTROL[a().tag]}</b>
            <span class="ui-num">{called(a())}{a().end ? `, ${remaining(left(a(), now())!)}` : ""}</span>
            <Show when={a().end}>
              <div class="held-bar"><i style={{ "--length": left(a(), now())! / Math.max(1, a().end - a().start) }} /></div>
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}

export function ReadyOverlay() {
  return (
    <section class="lacks glass" aria-label="Ready check">
      <strong>Missing</strong>
      <For each={lacks()} fallback={<span>Ready check</span>}>{(m) => <span>{chosenName(m)}</span>}</For>
    </section>
  );
}
