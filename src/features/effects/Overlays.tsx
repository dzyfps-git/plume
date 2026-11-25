import { createMemo, For, Show } from "solid-js";
import { near } from "../../live/store";
import type { Aura } from "../../live/types";
import { hideNames, settings } from "../../store";
import { ticking } from "../../ui/now";
import { Pic } from "../../ui/Pic";
import { who } from "../frames/logic";
import { called, chosenBuffs, chosenName, CONTROL, debuffs, effects, heldFor, hue, left, missing, remaining } from "./logic";
import { Tiles } from "./Tile";

const mine = () => near.you?.auras ?? [];
export const yourBuffs = () => {
  const { main, items } = chosenBuffs(mine(), settings.buffs);
  return [...main, ...items];
};
export const yourDebuffs = () => debuffs(mine());
export const holds = () => heldFor(mine(), settings.control);
export const lacks = () => missing(settings.ready, near);
export const sick = () => near.party.filter((unit) => effects(unit, near).some((a) => a.bad));

/** A buff as a long bar that runs out, with its name. */
function Bars(props: { of: readonly Aura[]; now: number; most: number }) {
  return (
    <div class="buff-bars">
      <For each={props.of.slice(0, props.most)}>
        {(a) => {
          const ms = () => left(a, props.now);
          return (
            <div class="buff-bar" data-ending={(ms() ?? 1e9) < 4_000 || undefined} style={{ "--hue": hue(called(a)), "--length": a.end ? ms()! / Math.max(1, a.end - a.start) : 1 }}>
              <i />
              <Pic effect={a.id} skill={a.skill} name={called(a)} />
              <span>{called(a)}{a.stacks > 1 ? ` x${a.stacks}` : ""}</span>
              <b class="ui-num">{ms() === undefined ? "" : remaining(ms()!)}</b>
            </div>
          );
        }}
      </For>
    </div>
  );
}

export function BuffsOverlay() {
  const now = ticking();
  const list = createMemo(() => chosenBuffs(mine(), settings.buffs));
  const show = (of: readonly Aura[], most: number) => (settings.buffs.as === "bars" ? <Bars of={of} now={now()} most={most} /> : <Tiles of={of} now={now()} most={most} />);
  return (
    <section class="strip glass" aria-label="Your buffs">
      {show(list().main, 24)}
      <Show when={list().items.length}><div class="strip-apart">{show(list().items, 8)}</div></Show>
    </section>
  );
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
            <span>{who(unit, near.party.indexOf(unit), hideNames())}</span>
            <Tiles of={debuffs(effects(unit, near))} now={now()} most={6} small />
          </div>
        )}
      </For>
    </section>
  );
}

export function ControlOverlay() {
  const now = ticking();
  const set = () => settings.control;
  return (
    <section class="held" classList={{ glass: set().look === "card" }} data-look={set().look} aria-label="Loss of control">
      <Show when={holds()} fallback={<><b>Stunned</b><span>Loss of control</span></>}>
        {(a) => {
          const time = () => (a().end ? remaining(left(a(), now())!) : "");
          const part = () => left(a(), now())! / Math.max(1, a().end - a().start);
          return (
            <Show
              when={set().look === "ring"}
              fallback={
                <>
                  <b>{CONTROL[a().tag]}{set().look === "text" && time() ? ` ${time()}` : ""}</b>
                  <Show when={set().look === "card" || set().by}><span class="ui-num">{[set().by ? called(a()) : "", set().look === "card" ? time() : ""].filter(Boolean).join(", ")}</span></Show>
                  <Show when={set().look === "card" && a().end}>
                    <div class="held-bar"><i style={{ "--length": part() }} /></div>
                  </Show>
                </>
              }
            >
              <div class="held-ring" style={{ "--part": a().end ? part() : 1 }}><Pic effect={a().id} skill={a().skill} name={called(a())} large /><em class="ui-num">{time()}</em></div>
              <b>{CONTROL[a().tag]}</b>
              <Show when={set().by}><span>{called(a())}</span></Show>
            </Show>
          );
        }}
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
