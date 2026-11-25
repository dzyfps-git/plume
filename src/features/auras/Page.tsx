import { createMemo, createSignal, For, Show } from "solid-js";
import { near } from "../../live/store";
import { change, settings } from "../../store";
import { AURA_KINDS, type AuraRule, type Named } from "../../store/settings";
import { Choices, Line, Slide } from "../../ui/Line";
import { Switch } from "../../ui/Switch";
import { followActions, recent, skills } from "../actions/store";
import { SignalLines } from "../alerts/SignalLines";
import { ANY_ITEM, called, chosenName } from "../effects/logic";
import { blank, effectsOf, KIND_NAMES, starter, VALUE_NAMES } from "./logic";
import "./auras.css";

const LOOK_NAMES = [["icon", "Icon"], ["bar", "Bar"], ["text", "Text"]] as const;
const newKey = (n = 0) => `${Date.now().toString(36)}${n}`;
const id = (n: Named) => `${n.id}|${n.name}`;

/** Effects to choose from: those on you and your target now, and those of your own fights. */
function known(yours: boolean): Named[] {
  const now = [...(near.you?.auras ?? []), ...(near.target?.auras ?? [])].filter((a) => !yours || a.yours);
  const kept = effectsOf(recent()).filter((e) => !yours || e.yours);
  const all = new Map<string, Named>();
  for (const e of [...now, ...kept]) if (!all.has(called(e))) all.set(called(e), { id: e.id, name: e.name });
  return [...all.values()].sort((a, b) => called(a).localeCompare(called(b)));
}

export function AurasPage() {
  followActions();
  const [picked, setPicked] = createSignal<string>();
  const open = () => settings.auras.find((a) => a.key === picked());
  const add = (rules: AuraRule[]) => {
    change((s) => s.auras.push(...rules));
    setPicked(rules[0]?.key);
  };
  const edit = (key: string, to: Partial<AuraRule>) =>
    change((s) => (s.auras = s.auras.map((a) => (a.key === key ? { ...a, ...to } : a))));
  const set = () => starter(recent(), skills(), newKey).filter((n) => !settings.auras.some((a) => a.kind === n.kind && id(a.of) === id(n.of)));
  return (
    <div class="page">
      <header class="page-head">
        <h1>Auras</h1>
        <button class="ui-button" disabled={!set().length} onClick={() => add(set())}>Make a set from your fights</button>
        <button class="ui-button" data-main onClick={() => add([blank(newKey())])}>
          <span class="ui-icon" aria-hidden="true">{""}</span>
          New aura
        </button>
      </header>
      <section class="block">
        <For
          each={settings.auras}
          fallback={<p class="ui-muted">An aura shows over the game when something is so: a buff runs out, a skill is back, your health is low. Turn the Auras overlay on to see them.</p>}
        >
          {(a) => (
            <div>
              <div class="ui-row-item aura-row" aria-selected={picked() === a.key}>
                <input type="checkbox" class="ui-check" aria-label={`${name(a)} on`} checked={a.on} onChange={(e) => edit(a.key, { on: e.currentTarget.checked })} />
                <span>{name(a)} <small class="ui-muted">{KIND_NAMES[a.kind]}</small></span>
                <button class="ui-button" aria-expanded={picked() === a.key} onClick={() => setPicked(picked() === a.key ? undefined : a.key)}>
                  {picked() === a.key ? "Close" : "Edit"}
                </button>
              </div>
              <Show when={picked() === a.key && open()}>{(o) => <Editor of={o()} set={(to) => edit(a.key, to)} remove={() => change((s) => (s.auras = s.auras.filter((x) => x.key !== a.key)))} />}</Show>
            </div>
          )}
        </For>
      </section>
      <Ready />
      <section class="block">
        <h2>Skills on the action bars</h2>
        <For each={skills()} fallback={<p class="ui-muted">A skill you use three times or more in a fight, with five seconds or more between, is learned here.</p>}>
          {(k) => (
            <Switch
              name={k.name}
              about={`Back after about ${Math.round(k.back / 1000)} s, as often as you managed in your fights`}
              on={!settings.skip.includes(k.skill)}
              set={(on) => change((s) => (s.skip = on ? s.skip.filter((n) => n !== k.skill) : [...s.skip, k.skill]))}
            />
          )}
        </For>
      </section>
    </div>
  );
}

const name = (a: AuraRule) => (a.kind === "low" ? "Low health" : a.of.id || a.of.name ? called(a.of) : "Nothing chosen yet");

function Editor(props: { of: AuraRule; set: (to: Partial<AuraRule>) => void; remove: () => void }) {
  const choices = createMemo<Named[]>(() => {
    if (props.of.kind === "low") return [];
    const list = props.of.kind === "ready" ? skills().map((k) => ({ id: k.skill, name: k.name })) : known(["target", "untarget", "party"].includes(props.of.kind));
    // What was chosen before stays in the list, even when no fight knows it any more.
    const own = props.of.of;
    return (own.id || own.name) && !list.some((n) => id(n) === id(own)) ? [own, ...list] : list;
  });
  const value = () => VALUE_NAMES[props.of.kind];
  return (
    <div class="ui-rise">
      <Line name="Shows when">
        <select class="ui-select" aria-label="Shows when" value={props.of.kind} onChange={(e) => props.set({ kind: e.currentTarget.value as AuraRule["kind"], value: e.currentTarget.value === "low" ? 35 : 0 })}>
          <For each={AURA_KINDS}>{(k) => <option value={k}>{KIND_NAMES[k]}</option>}</For>
        </select>
      </Line>
      <Show when={props.of.kind !== "low"}>
        <Line name={props.of.kind === "ready" ? "Skill" : "Effect"} about={choices().length ? undefined : "Fight once, and what is seen is offered here."}>
          <select
            class="ui-select aura-pick"
            aria-label={props.of.kind === "ready" ? "Skill" : "Effect"}
            value={id(props.of.of)}
            onChange={(e) => props.set({ of: choices().find((n) => id(n) === e.currentTarget.value) ?? { id: 0, name: "" } })}
          >
            <option value="0|">Choose</option>
            <For each={choices()}>{(n) => <option value={id(n)} selected={id(n) === id(props.of.of)}>{called(n)}</option>}</For>
          </select>
        </Line>
      </Show>
      <Show when={value()}>
        {(v) => (
          <Line name={v().name} about={v().about}>
            <Slide name={v().name} least={v().least} most={v().most} step={1} value={props.of.value} text={`${props.of.value}${v().unit}`} set={(n) => props.set({ value: n })} />
          </Line>
        )}
      </Show>
      <Line name="Look">
        <Choices name="Look" all={LOOK_NAMES} value={props.of.look} set={(look) => props.set({ look })} />
      </Line>
      <Switch name="Glow" on={props.of.glow} set={(glow) => props.set({ glow })} />
      <Switch name="Only in fights" on={props.of.fight} set={(fight) => props.set({ fight })} />
      <SignalLines of={props.of} words={name(props.of)} set={props.set} />
      <Line name="Not needed any more">
        <button class="ui-button" onClick={props.remove}>Remove it</button>
      </Line>
    </div>
  );
}

function Ready() {
  const list = createMemo(() => {
    const all = [ANY_ITEM, ...effectsOf(recent()).filter((e) => e.onYou && e.up > e.ms * 0.5).map((e) => ({ id: e.id, name: e.name })), ...(near.you?.auras ?? []).filter((a) => !a.bad).map((a) => ({ id: a.id, name: a.name }))];
    const unique = new Map(all.map((n) => [chosenName(n), n]));
    for (const n of settings.ready) unique.set(chosenName(n), n);
    return [...unique.values()];
  });
  const chosen = (n: Named) => settings.ready.some((r) => chosenName(r) === chosenName(n));
  return (
    <section class="block">
      <h2>Ready check</h2>
      <p class="ui-muted">What you want on before a pull. The Ready check overlay says what is missing, out of fights.</p>
      <For each={list()}>
        {(n) => (
          <Switch
            name={chosenName(n)}
            on={chosen(n)}
            set={(on) => change((s) => (s.ready = on ? [...s.ready, { ...n }] : s.ready.filter((r) => chosenName(r) !== chosenName(n))))}
          />
        )}
      </For>
    </section>
  );
}
