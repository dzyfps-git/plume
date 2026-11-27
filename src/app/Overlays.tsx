import { createMemo, createResource, createSignal, For, Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { editOverlays, secondScreen } from "../api";
import { FEATURES } from "../features";
import { followActions, skills } from "../features/actions/store";
import { SignalLines } from "../features/alerts/SignalLines";
import { known } from "../features/auras/Page";
import { callFile } from "../features/map/data";
import { called, CONTROL, same } from "../features/effects/logic";
import { GROUPS, overlayName, widthOf, type Feature } from "../features/types";
import { WHEN_NAMES } from "../overlay/rules";
import { change, settings } from "../store";
import { FPS, place, rule, SECOND, WHEN, type Rule, type Settings, type When } from "../store/settings";
import { CLASSES } from "../ui/classes";
import { Group } from "../ui/Group";
import { SECOND_NAMES } from "../second/parts";
import { Chips, Choices, Line, Slide } from "../ui/Line";
import { Pic } from "../ui/Pic";
import { Switch } from "../ui/Switch";
import { entries } from "../live/store";
import { openPage } from "../api";
import { kindOf, nameOf } from "../features/resources/logic";
import { MeterGroups } from "./Look";
import { LayoutGroup, ScreenMap } from "./Layouts";
import { Preview } from "./Preview";
import { Shell } from "./Shell";

export function OverlaysPage() {
  return (
    <Shell
      title="Overlays"
      action={
        <button class="ui-button" data-main aria-keyshortcuts={settings.hotkeys.edit} onClick={() => void editOverlays("move")}>
          <span class="ui-icon" aria-hidden="true">{"\ue7c2"}</span>
          Move them
        </button>
      }
    >
      <ScreenMap />
      <LayoutGroup />
      <OverlayGroups />
    </Shell>
  );
}

/** The overlays' settings. `still` leaves out the pictures. */
export function OverlayGroups(props: { still?: boolean }) {
  const over = () => settings.overlay;
  const set = <K extends keyof Settings["overlay"]>(key: K) => (value: Settings["overlay"][K]) => change((s) => (s.overlay[key] = value));
  return (
    <>
      <Group name="All overlays">
        <Switch name="Show overlays" about={settings.hotkeys.overlay || "No key"} on={over().on} set={set("on")} />
        <Switch name="Only over the game" about="Hidden while another window is in front." on={over().onlyInGame} set={set("onlyInGame")} />
        <Switch name="Hide when there is nothing to show" on={over().hideEmpty} set={set("hideEmpty")} />
        <Line name="Size of all"><Slide name="Size of all" least={0.6} most={1.6} step={0.05} value={over().size} text={`${Math.round(over().size * 100)}%`} set={set("size")} /></Line>
        <Line name="Game UI size" about="As set in the game, so that overlays grow and shrink with it.">
          <Choices name="Game UI size" all={[1, 2, 3, 4, 5].map((n) => [n, String(n)] as const)} value={over().game} set={set("game")} />
        </Line>
        <Switch name="Snap while moving" about="To the screen's edges and to each other." on={over().snap} set={set("snap")} />
        <Switch name="Handles while you play" about="Drag an overlay by its top edge while the mouse pointer shows. Right-click it for its menu." on={over().grips} set={set("grips")} />
        <Switch name="Button over the game" about={`Opens the overlay controls. So does ${settings.hotkeys.quick || "a key you set in Settings"}.`} on={over().button} set={set("button")} />
        <Switch name="Dim the button" about="Half see-through while the mouse pointer is hidden in the game." on={over().buttonDim} set={set("buttonDim")} />
        <Switch name="Care for an OLED screen" about="Overlays fade after a minute without a fight, and move two points every few minutes." on={settings.oled} set={(on) => change((s) => (s.oled = on))} />
        <Switch name="Names and Combat Power hidden" about={`Yours too, for pictures and streams. ${settings.hotkeys.discreet || "No key"}`} on={settings.discreet} set={(on) => change((s) => (s.discreet = on))} />
        <Line name="Bar movement" about="Frames a second. Higher is smoother and costs more.">
          <Choices name="Bar movement" all={FPS.map((n) => [n, n ? String(n) : "Screen"] as const)} value={settings.fps} set={(n) => change((s) => (s.fps = n))} />
        </Line>
        <Line name="A fight, for overlays shown in fights" about="What starts one: the game's word, your own hits, or the party's.">
          <Choices name="A fight starts with" all={[["game", "The game's word"], ["you", "Your hits"], ["party", "The party's hits"]] as const} value={over().fightBy} set={set("fightBy")} />
        </Line>
        <Line name="They stay after a fight"><Slide name="They stay after a fight" least={0} most={60} step={5} value={over().linger} text={over().linger ? `${over().linger} s` : "No"} set={set("linger")} /></Line>
        <Line name="Numbers change every" about="How often the numbers over the game are drawn again. 1000 ms is one second. 250 ms is smooth and light; 50 ms is the most live and uses the most CPU; 1 s is the lightest.">
          <Slide name="Numbers change every" least={50} most={1000} step={50} value={settings.updateMs} text={`${settings.updateMs} ms`} set={(v) => change((s) => (s.updateMs = v))} />
        </Line>
      </Group>
      <SecondGroup />
      <For each={GROUPS}>
        {(group) => <Group name={group}><For each={FEATURES.filter((f) => f.overlay?.group === group)}>{(f) => <One of={f} still={props.still} />}</For></Group>}
      </For>
    </>
  );
}

function SecondGroup() {
  const set = <K extends keyof Settings["second"]>(key: K) => (value: Settings["second"][K]) => change((s) => (s.second[key] = value));
  return (
    <Group name="Second screen">
      <Line name="A page for another screen" about={`Opens beside the game and remembers its place. ${settings.hotkeys.second || "No key"}`}>
        <button class="ui-button" onClick={() => void secondScreen().catch(console.error)}>Open or close</button>
      </Line>
      <Line name="What is on it" wide><Chips name="What is on it" all={SECOND} names={SECOND_NAMES} value={settings.second.parts} set={set("parts")} /></Line>
      <Line name="Size of its parts"><Slide name="Size of its parts" least={0.7} most={2} step={0.05} value={settings.second.size} text={`${Math.round(settings.second.size * 100)}%`} set={set("size")} /></Line>
    </Group>
  );
}

/** One overlay: on or off, and what it can be told. */
function One(props: { of: Feature; still?: boolean }) {
  const name = () => overlayName(props.of);
  const at = () => place(settings.places[props.of.id], props.of.overlay!.place);
  const [open, setOpen] = createSignal(false);
  const now = () => rule(settings.rules[props.of.id]);
  const set = (to: Partial<Rule>) => change((s) => (s.rules = { ...s.rules, [props.of.id]: { ...now(), ...to } }));
  const more = () => (
    <>
      <Line name="When it shows">
        <select class="ui-select" aria-label={`When ${name()} shows`} value={now().when} onChange={(e) => set({ when: e.currentTarget.value as When })}>
          <For each={WHEN}>{(w) => <option value={w}>{WHEN_NAMES[w]}</option>}</For>
        </select>
      </Line>
      <Line name="For which class">
        <select class="ui-select" aria-label={`Class ${name()} shows for`} value={now().job} onChange={(e) => set({ job: e.currentTarget.value as Rule["job"] })}>
          <option value="">Every class</option>
          <For each={Object.entries(CLASSES)}>{([job, c]) => <option value={job}>{c.name}</option>}</For>
        </select>
      </Line>
      <Show when={MORE[props.of.id]}>{(more) => <Dynamic component={more()} />}</Show>
    </>
  );
  return (
    <div class="over">
      <div class="over-head">
        <Switch name={name()} about={props.of.overlay!.about} on={at().on} set={(on) => change((s) => (s.places = { ...s.places, [props.of.id]: { ...at(), on } }))} />
        <Show when={!props.still}>
          <button class="ui-icon-button" aria-label={`Options of ${name()}`} aria-expanded={open()} onClick={() => setOpen(!open())}>{open() ? "\ue70e" : "\ue70d"}</button>
        </Show>
      </div>
      <Show when={props.still}><Group name={name()}>{more()}</Group></Show>
      <Show when={open() && !props.still}>
        <div class="over-more">
          <Preview width={widthOf(props.of.overlay!)}><Dynamic component={props.of.overlay!.view} /></Preview>
          {more()}
        </div>
      </Show>
    </div>
  );
}

/** What else an overlay can be told, by its id. */
const MORE: Partial<Record<string, Component>> = { boss: Boss, finish: Finish, party: Party, force: Party, actions: Cooldowns, buffs: Buffs, control: Control, alerts: Calls, resources: Tickets, meter: () => <MeterGroups still /> };

/** Smallest and largest an overlay can be made, by its buttons, a corner or a slider. */
export const SCALE = { least: 0.5, most: 2.5 } as const;

/** Every setting of one overlay, the same in the app and over the game: shown or not, its size, when, and its own. */
export function OverlaySettings(props: { of: Feature; over?: boolean }) {
  const name = () => overlayName(props.of);
  const at = () => place(settings.places[props.of.id], props.of.overlay!.place);
  const put = (to: Partial<ReturnType<typeof at>>) => change((s) => (s.places = { ...s.places, [props.of.id]: { ...at(), ...to } }), props.over);
  const now = () => rule(settings.rules[props.of.id]);
  const set = (to: Partial<Rule>) => change((s) => (s.rules = { ...s.rules, [props.of.id]: { ...now(), ...to } }), props.over);
  return (
    <div class="over-settings">
      <Switch name="Shown" about={props.of.overlay!.about} on={at().on} set={(on) => put({ on })} />
      <Line name="Size"><Slide name={`Size of ${name()}`} least={SCALE.least} most={SCALE.most} step={0.05} value={at().scale} text={`${Math.round(at().scale * 100)}%`} set={(scale) => put({ scale })} /></Line>
      <Switch name="Locked" about="Not moved or sized by mistake." on={!!at().locked} set={(locked) => put({ locked })} />
      <Line name="When it shows">
        <select class="ui-select" aria-label={`When ${name()} shows`} value={now().when} onChange={(e) => set({ when: e.currentTarget.value as When })}>
          <For each={WHEN}>{(w) => <option value={w}>{WHEN_NAMES[w]}</option>}</For>
        </select>
      </Line>
      <Line name="For which class">
        <select class="ui-select" aria-label={`Class ${name()} shows for`} value={now().job} onChange={(e) => set({ job: e.currentTarget.value as Rule["job"] })}>
          <option value="">Every class</option>
          <For each={Object.entries(CLASSES)}>{([job, c]) => <option value={job}>{c.name}</option>}</For>
        </select>
      </Line>
      <Show when={MORE[props.of.id]}>{(more) => <Dynamic component={more()} />}</Show>
      <Show when={props.over && props.of.page}>
        <button class="ui-button" onClick={() => void openPage(props.of.id)}>Open its page in the app</button>
      </Show>
    </div>
  );
}

/** Which entries and tickets show, beside Odyle Energy: those the game counts that have a kind. */
function Tickets() {
  const ids = () => entries().counts.map(([id]) => id).filter((id) => kindOf(id, settings.resources));
  const shown = (id: number) => !!settings.resources.find((r) => r.id === id)?.show;
  const flip = (id: number) =>
    change((s) => {
      const at = s.resources.findIndex((r) => r.id === id);
      if (at < 0) s.resources.push({ id, name: "", kind: "", show: true });
      else s.resources[at] = { ...s.resources[at], show: !s.resources[at].show };
    });
  return (
    <Group name="Tickets shown">
      <Show when={ids().length} fallback={<p class="ui-muted ui-small">Your entries show here once the game has said them: open the game's dungeon list once.</p>}>
        <For each={ids()}>{(id) => <Switch name={nameOf(id, settings.resources)} on={shown(id)} set={() => flip(id)} />}</For>
      </Show>
    </Group>
  );
}

const against = (key: keyof Settings["against"]) => ({ on: settings.against[key], set: (on: boolean) => change((s) => (s.against[key] = on)) });

function Boss() {
  return (
    <>
      <Switch name="Your best kill as a mark" about="Where its health was by now. Green while you are ahead." {...against("rival")} />
      <Switch name="Seconds ahead of it, or behind" {...against("time")} />
      <Switch name="Where earlier pulls ended" about="Small marks on the bar, the last eight." {...against("wipes")} />
    </>
  );
}

function Finish() {
  return (
    <>
      <Switch name="Grades" about="0 to 100 against your own kills of that boss with that class, from three others on. In History too." {...against("grade")} />
      <Switch name="Bursts" about="How much of them came under others' buffs and just after a stagger break." {...against("burst")} />
      <Switch name="One thing to do better" {...against("tip")} />
      <Switch name="Streaks" {...against("streak")} />
      <Switch name="Class art" about="From your picture folder. In reports too." {...against("art")} />
    </>
  );
}

/** Party and Force frames look the same. */
function Party() {
  const p = () => settings.party;
  const set = <K extends keyof Settings["party"]>(key: K) => (value: Settings["party"][K]) => change((s) => (s.party[key] = value));
  return (
    <>
      <Line name="Columns" about="Of a party. A Force stands in its groups."><Choices name="Columns" all={[[1, "One"], [2, "Two"]] as const} value={p().columns} set={set("columns")} /></Line>
      <Line name="Width of a card"><Slide name="Width of a card" least={160} most={420} step={10} value={p().width} text={String(p().width)} set={set("width")} /></Line>
      <Line name="Height of a card"><Slide name="Height of a card" least={22} most={56} step={1} value={p().height} text={String(p().height)} set={set("height")} /></Line>
      <Line name="Effects"><Choices name="Effects" all={[["on", "On the card"], ["beside", "Beside it"], ["off", "None"]] as const} value={p().icons} set={set("icons")} /></Line>
      <Line name="Most effects"><Slide name="Most effects" least={1} most={8} step={1} value={p().most} text={String(p().most)} set={set("most")} /></Line>
      <Line name="Order" about="Those who hold, those who heal, the rest. A Force keeps the game's.">
        <Choices name="Order" all={[["game", "The game's"], ["role", "Role"], ["name", "Name"]] as const} value={p().order} set={set("order")} />
      </Line>
      <Switch name="Yourself too" on={p().you} set={set("you")} />
      <Line name="Health"><Choices name="Health" all={[["percent", "%"], ["number", "Number"], ["both", "Both"], ["off", "None"]] as const} value={p().health} set={set("health")} /></Line>
      <Switch name="Class marks on the cards" on={p().mark} set={set("mark")} />
      <Switch name="Combat Power on the cards" on={p().power} set={set("power")} />
      <Line name="Red edge below"><Slide name="Red edge below" least={0} most={90} step={5} value={p().low} text={p().low ? `${p().low}%` : "Never"} set={set("low")} /></Line>
    </>
  );
}

function Cooldowns() {
  followActions();
  const c = () => settings.cooldowns;
  const set = <K extends keyof Settings["cooldowns"]>(key: K) => (value: Settings["cooldowns"][K]) => change((s) => (s.cooldowns[key] = value));
  return (
    <>
      <Switch name="Ready ones too" on={c().ready} set={set("ready")} />
      <Line name="Brightness while cooling"><Slide name="Brightness while cooling" least={0.2} most={1} step={0.05} value={c().dim} text={`${Math.round(c().dim * 100)}%`} set={set("dim")} /></Line>
      <Line name="Size of a skill"><Slide name="Size of a skill" least={24} most={56} step={2} value={c().size} text={String(c().size)} set={set("size")} /></Line>
      <Line name="Skills" about={skills().length ? `${skills().filter((k) => !settings.skip.includes(k.skill)).length} of ${skills().length} shown.` : "Learned from your fights."} wide>
        <div class="ui-row" role="group" aria-label="Skills">
          <For each={skills()}>
            {(k) => {
              const on = () => !settings.skip.includes(k.skill);
              return <button class="ui-chip" aria-pressed={on()} onClick={() => change((s) => (s.skip = on() ? [...s.skip, k.skill] : s.skip.filter((n) => n !== k.skill)))}>{k.name}</button>;
            }}
          </For>
        </div>
      </Line>
    </>
  );
}

function Buffs() {
  followActions();
  const b = () => settings.buffs;
  const [unnamed, setUnnamed] = createSignal(false);
  const all = createMemo(() => known(false, true).filter((e) => e.name || unnamed()));
  const nameless = createMemo(() => known(false, true).filter((e) => !e.name).length);
  const left = (e: { id: number; name: string }) => b().skip.some((n) => same(n, e));
  return (
    <>
      <Line name="Buffs as"><Choices name="Buffs as" all={[["tiles", "Tiles"], ["bars", "Long bars"]] as const} value={b().as} set={(v) => change((s) => (s.buffs.as = v))} /></Line>
      <Line name="Scrolls, potions and food">
        <Choices name="Scrolls, potions and food" all={[["with", "Among them"], ["apart", "Apart"], ["off", "None"]] as const} value={b().items} set={(v) => change((s) => (s.buffs.items = v))} />
      </Line>
      <Line name="Which buffs" about={all().length ? `${all().filter((e) => !left(e)).length} of ${all().length} shown.` : "Those of your fights are listed here."} wide>
        <div class="ui-row" role="group" aria-label="Which buffs">
          <For each={all()}>
            {(e) => <button class="ui-chip" aria-pressed={!left(e)} onClick={() => change((s) => (s.buffs.skip = left(e) ? s.buffs.skip.filter((n) => !same(n, e)) : [...s.buffs.skip, e]))}><Pic effect={e.id} name={called(e)} />{called(e)}</button>}
          </For>
          <Show when={nameless()}>
            <button class="ui-chip" aria-pressed={unnamed()} onClick={() => setUnnamed(!unnamed())}>{unnamed() ? "Hide" : "Show"} {nameless()} with no name yet</button>
          </Show>
        </div>
      </Line>
    </>
  );
}

/** Boss calls of `calls.json`, by dungeon. */
function Calls() {
  const c = () => settings.calls;
  const [file] = createResource(() => callFile().catch(() => null));
  const groups = createMemo(() => {
    const all = new Map<string, string[]>();
    for (const [key, b] of Object.entries(file()?.bosses ?? {})) all.set(b.group, [...(all.get(b.group) ?? []), key]);
    return [...all].sort(([a], [b]) => a.localeCompare(b));
  });
  const names = () => Object.fromEntries(Object.entries(file()?.bosses ?? {}).map(([k, b]) => [k, b.name]));
  return (
    <>
      <Switch name="Boss calls" about="The boss's lines and what to do, as its casts begin." on={c().on} set={(v) => change((s) => (s.calls.on = v))} />
      <Show when={c().on}>
        <Line name="Say"><Choices name="Say" all={[["say", "What to do"], ["line", "The boss's line"]] as const} value={c().mode} set={(v) => change((s) => (s.calls.mode = v))} /></Line>
        <Switch name="Aloud" about="With the voice of Timers." on={c().voice} set={(v) => change((s) => (s.calls.voice = v))} />
        <Show when={file() === null}><p class="ui-muted ui-small">No boss calls yet. The engine's tools/calls.py makes them.</p></Show>
        <For each={groups()}>
          {([group, keys]) => (
            <Line name={group} wide>
              <Chips name={group} all={keys} names={names()} value={keys.filter((k) => !c().off.includes(k))} set={(v) => change((s) => (s.calls.off = [...s.calls.off.filter((k) => !keys.includes(k)), ...keys.filter((k) => !v.includes(k))]))} />
            </Line>
          )}
        </For>
      </Show>
    </>
  );
}

function Control() {
  const c = () => settings.control;
  const kinds = Object.keys(CONTROL);
  const held = () => settings.alerts.held;
  return (
    <>
      <Line name="Loss of control as"><Choices name="Loss of control as" all={[["card", "Card"], ["ring", "Ring"], ["text", "Text"]] as const} value={c().look} set={(v) => change((s) => (s.control.look = v))} /></Line>
      <Switch name="What did it" about="The skill or effect that holds you." on={c().by} set={(v) => change((s) => (s.control.by = v))} />
      <Line name="Nothing shorter than"><Slide name="Nothing shorter than" least={0} most={3} step={0.5} value={c().least} text={c().least ? `${c().least} s` : "All"} set={(v) => change((s) => (s.control.least = v))} /></Line>
      <Line name="Kinds" wide>
        <Chips name="Kinds" all={kinds} names={CONTROL} value={kinds.filter((k) => !c().skip.includes(k))} set={(v) => change((s) => (s.control.skip = kinds.filter((k) => !v.includes(k))))} />
      </Line>
      <Switch name="Sound as it begins" about="The same as the alert You lose control." on={held().on} set={(on) => change((s) => (s.alerts.held.on = on))} />
      <Show when={held().on}><SignalLines of={held()} words="Stunned" set={(to) => change((s) => Object.assign(s.alerts.held, to))} /></Show>
    </>
  );
}
