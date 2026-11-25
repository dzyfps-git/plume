import { For } from "solid-js";
import { ACTS } from "../features/meter/Buttons";
import { VIEW_NAMES } from "../features/meter/logic";
import { MeterOverlay } from "../features/meter/Overlay";
import { ODYLE_NAMES } from "../features/resources/logic";
import { change, settings } from "../store";
import {
  BUTTONS, FONTS, FOOTER, ODYLE, ODYLE_RUN, STYLES, THEMES, TONES, VIEWS,
  type Button, type Footer, type Look, type Meter, type Settings, type Tone, type View,
} from "../store/settings";
import { CLASSES } from "../ui/classes";
import { Group } from "../ui/Group";
import { Chips, Choices, Colour, Line, Slide } from "../ui/Line";
import { RunLength } from "../ui/RunLength";
import { Switch } from "../ui/Switch";
import { Preview } from "./Preview";
import { Shell } from "./Shell";

const FOOTER_NAMES: Record<Footer, string> = { ping: "Ping", total: "Total", flight: "Flight", odyle: "Odyle Energy", entries: "Tickets", kina: "Kina today", points: "Abyss Points", crit: "Crit", back: "Back attacks" };
const STYLE_NAMES: Record<Meter["style"], string> = { bar: "Full bars", line: "Lines of light", cards: "Cards", gauge: "Gauges", table: "Table" };
const THEME_NAMES: Record<Look["theme"], string> = { glass: "Glass", minimal: "Minimal", solid: "Solid", light: "Light" };
const FONT_NAMES: Record<Look["font"], string> = { house: "House", narrow: "Narrow", round: "Round", mono: "Even" };
const BUTTON_NAMES = Object.fromEntries(BUTTONS.map((b) => [b, ACTS[b].name])) as Record<Button, string>;
const TONE_NAMES: Record<Tone, [string, string]> = {
  bonus: ["bonus", "On top of what you have, and what comes back."],
  best: ["best", "First place, a burst, a new best."],
  ready: ["ready", "Can be used, or better than before."],
  ending: ["ending", "Soon over, or nearly full."],
  danger: ["danger", "Low health, deaths, what holds you."],
  you: ["you", "Your own row."],
};

const meter = <K extends keyof Meter>(key: K) => (value: Meter[K]) => change((s) => (s.meter[key] = value));
const look = <K extends keyof Look>(key: K) => (value: Look[K]) => change((s) => (s.look[key] = value));
const fights = <K extends keyof Settings["fights"]>(key: K) => (value: Settings["fights"][K]) => change((s) => (s.fights[key] = value));
const odyle = <K extends keyof Settings["odyle"]>(key: K) => (value: Settings["odyle"][K]) => change((s) => (s.odyle[key] = value));
const percent = (n: number) => `${Math.round(n * 100)}%`;

/** Each style as it looks, to choose from. Needs a sample. */
export function Styles() {
  return (
    <div class="styles" role="radiogroup" aria-label="Style">
      <For each={STYLES}>
        {(style) => (
          <button class="style-pick" role="radio" aria-checked={settings.meter.style === style} aria-label={STYLE_NAMES[style]} onClick={() => meter("style")(style)}>
            <div class="style-picture" data-theme="dark" aria-hidden="true" inert>
              <div style={{ width: `${settings.look.width}px` }}><MeterOverlay look={{ style, rows: 4, boss: false, head: false, footer: [], casts: false }} /></div>
            </div>
            <span>{STYLE_NAMES[style]}</span>
          </button>
        )}
      </For>
    </div>
  );
}

/** The meter's settings. `still` leaves out the pictures. */
export function MeterGroups(props: { still?: boolean }) {
  const m = () => settings.meter;
  const l = () => settings.look;
  return (
    <>
      <Group name="Style">
        {props.still ? <Line name="Style"><Choices name="Style" all={STYLES.map((s) => [s, STYLE_NAMES[s]] as const)} value={m().style} set={meter("style")} /></Line> : <Styles />}
        <Line name="Width"><Slide name="Width" least={220} most={460} step={10} value={l().width} text={`${l().width}`} set={look("width")} /></Line>
        <Line name="Bar height"><Slide name="Bar height" least={18} most={40} step={1} value={l().height} text={`${l().height}`} set={look("height")} /></Line>
        <Line name="Rows" about="Yours always shows."><Slide name="Rows" least={1} most={24} step={1} value={m().rows} text={String(m().rows)} set={meter("rows")} /></Line>
        <Line name="Edge that stays put" about="As rows come and go.">
          <Choices name="Edge that stays put" all={[["top", "Top"], ["bottom", "Bottom"]] as const} value={m().edge} set={meter("edge")} />
        </Line>
      </Group>
      <Group name="Rows and numbers">
        <Line name="Shows" about={settings.hotkeys.view ? `${settings.hotkeys.view} goes to the next.` : undefined}>
          <select class="ui-select" aria-label="What the meter shows" value={m().view} onChange={(e) => meter("view")(e.currentTarget.value as View)}>
            <For each={VIEWS}>{(view) => <option value={view}>{VIEW_NAMES[view]}</option>}</For>
          </select>
        </Line>
        <Line name="Left of the number">
          <Choices name="Left of the number" all={[["", "Nothing"], ["total", "Total"], ["share", "Share"]] as const} value={m().left} set={meter("left")} />
        </Line>
        <Line name="Right of the number">
          <Choices name="Right of the number" all={[["", "Nothing"], ["total", "Total"], ["share", "Share"]] as const} value={m().right} set={meter("right")} />
        </Line>
        <Switch name="Numbers in full" about="46,200 in place of 46.2K." on={m().full} set={meter("full")} />
        <Line name="By the name" about="Other players' is never written down.">
          <Choices name="By the name" all={[["power", "Combat Power"], ["level", "Item level"], ["", "Nothing"]] as const} value={m().corner} set={meter("corner")} />
        </Line>
        <Line name="By whose name">
          <Choices name="By whose name" all={[["you", "Yours"], ["all", "Everyone's"]] as const} value={m().corners} set={meter("corners")} />
        </Line>
        <Switch name="You at the top" on={m().top} set={meter("top")} />
        <Switch name="You out of fights too" about="Your row stays while there is no fight." on={m().always} set={meter("always")} />
        <Switch name="Gap to the next place" about="On your row: how much damage a second you are behind." on={m().gap} set={meter("gap")} />
        <Switch name="Bursts" about="A light on rows that are far above their own average." on={m().burst} set={meter("burst")} />
        <Switch name="The dead" about="Grey, with how long since." on={m().dead} set={meter("dead")} />
        <Switch name="Your last casts" about="As pictures under your row." on={m().casts} set={meter("casts")} />
        <Switch name="What buffs added" about="A pale part of the bar: damage that others' buffs gave. Full bars only." on={m().buffShare} set={meter("buffShare")} />
        <Switch name="Your best as a row" about="Where your best fight of this target would be by now." on={m().ghost} set={meter("ghost")} />
        <Switch name="Your pull" about="Which try it is, and how it goes against your best." on={m().head} set={meter("head")} />
        <Switch name="Boss health" about="Above the rows, with its stagger gauge and how long until it falls." on={m().boss} set={meter("boss")} />
        <Switch name="Fight clock" on={m().clock} set={meter("clock")} />
        <Switch name="Class marks" on={m().icons} set={meter("icons")} />
        <Switch name="Hide other players' names" about="In every overlay." on={m().hideNames} set={meter("hideNames")} />
      </Group>
      <Group name="One bar">
        <Switch name="One bar out of fights" about="The meter shrinks to you, Odyle Energy and the buttons, and opens with the next fight." on={m().compact} set={meter("compact")} />
        <Switch name="One bar in fights too" on={m().small} set={meter("small")} />
        <Line name="On the one bar" wide><Chips name="On the one bar" all={FOOTER} names={FOOTER_NAMES} value={m().footerSmall} set={meter("footerSmall")} /></Line>
      </Group>
      <Group name="Footer">
        <Line name="Under the rows" wide><Chips name="Footer" all={FOOTER} names={FOOTER_NAMES} value={m().footer} set={meter("footer")} /></Line>
        <Switch name="Footer while the meter is locked" on={m().footerLocked} set={meter("footerLocked")} />
        <Line name="Ping" about="The game asks its server by itself and waits for the answer. Plume reads that from the copy of your traffic and asks nothing of its own. Packet loss is not read.">
          <Choices name="Ping" all={[["round", "There and back"], ["oneway", "One way"]] as const} value={settings.pingAs} set={(v) => change((s) => (s.pingAs = v))} />
        </Line>
      </Group>
      <Group name="Odyle Energy and tickets">
        <Line name="Parts of Odyle Energy"><Chips name="Parts of Odyle Energy" all={ODYLE} names={ODYLE_NAMES} value={settings.odyle.parts} set={odyle("parts")} /></Line>
        <Line name="Where it stands" about="Out of the meter it is an overlay of its own: Resources.">
          <Choices
            name="Where it stands" all={[["bottom", "Footer"], ["top", "Under the title"], ["out", "Out of the meter"]] as const} value={settings.odyle.place}
            set={(v) =>
              change((s) => {
                s.odyle.place = v;
                if (v === "out") s.places = { ...s.places, resources: { ...{ x: 1, y: 0.5, scale: 1 }, ...s.places.resources, on: true } };
              })
            }
          />
        </Line>
        <Line name="A run takes" about="80 is claiming twice in one run, with a membership.">
          <Choices name="A run takes" all={ODYLE_RUN.map((n) => [n, String(n)] as const)} value={settings.odyleRun} set={(n) => change((s) => (s.odyleRun = n))} />
        </Line>
        <Switch name="Membership" about="Odyle Energy grows to 840 in place of 560, and keys further too." on={settings.odyle.member} set={odyle("member")} />
        <Switch name="Say when it is nearly full" on={settings.odyle.warn} set={odyle("warn")} />
        <Switch name="Show each change" about="A figure pops as one is used or comes." on={settings.odyle.pop} set={odyle("pop")} />
        <Switch name="Ring until the next one" about="Fills round the picture. For those that come every few hours it starts once one was seen to come." on={settings.odyle.ring} set={odyle("ring")} />
      </Group>
      <Group name="Fights">
        <Line name="A fight is over after" about="Without a hit. Five seconds after a kill.">
          <Slide name="A fight is over after" least={5} most={60} step={5} value={settings.fights.end} text={`${settings.fights.end} s`} set={fights("end")} />
        </Line>
        <Line name="A boss fight is over after">
          <Slide name="A boss fight is over after" least={5} most={60} step={5} value={settings.fights.bossEnd} text={`${settings.fights.bossEnd} s`} set={fights("bossEnd")} />
        </Line>
        <Line name="Then its numbers"><Choices name="Then its numbers" all={[["keep", "Stay"], ["clear", "Go"]] as const} value={settings.fights.after} set={fights("after")} /></Line>
        <Line name="Which fights" about="The last one that counts stays until the next.">
          <Choices name="Which fights" all={[["", "All"], ["boss", "Bosses"], ["dungeon", "Bosses in dungeons"]] as const} value={settings.fights.only} set={fights("only")} />
        </Line>
        <Switch name="Training by itself" about="At the first hit on a dummy, and back at the first hit on anything else." on={settings.training.auto} set={(on) => change((s) => (s.training.auto = on))} />
        <Line name="A training run lasts"><RunLength /></Line>
      </Group>
      <Group name="Buttons and lock">
        <Switch name="Meter locked" about="Clicks go through it to the game, but for the buttons chosen here. Unlocked it can be dragged." on={m().locked} set={meter("locked")} />
        <Line name="Buttons while unlocked" wide><Chips name="Buttons while unlocked" all={BUTTONS} names={BUTTON_NAMES} value={m().buttons} set={meter("buttons")} /></Line>
        <Line name="Buttons while locked" wide><Chips name="Buttons while locked" all={BUTTONS} names={BUTTON_NAMES} value={m().buttonsLocked} set={meter("buttonsLocked")} /></Line>
      </Group>
      <Group name="Theme and colours">
        <Line name="Meter theme"><Choices name="Meter theme" all={THEMES.map((t) => [t, THEME_NAMES[t]] as const)} value={l().theme} set={look("theme")} /></Line>
        <Line name="Background colour"><Colour name="Background colour" value={l().background} own="var(--surface-base)" set={look("background")} /></Line>
        <Line name="Class mark behind a row"><Slide name="Class mark behind a row" least={0} most={0.6} step={0.05} value={l().mark} text={percent(l().mark)} set={look("mark")} /></Line>
        <For each={TONES}>
          {(t) => (
            <Line name={`Colour of ${TONE_NAMES[t][0]}`} about={TONE_NAMES[t][1]}>
              <Colour name={`Colour of ${TONE_NAMES[t][0]}`} value={settings.tones[t] ?? ""} own={`var(--tone-${t})`} set={(v) => change((s) => (s.tones = { ...s.tones, [t]: v }))} />
            </Line>
          )}
        </For>
        <For each={Object.entries(CLASSES)}>
          {([job, c]) => (
            <Line name={`Colour of ${c.name}`}>
              <Colour name={`Colour of ${c.name}`} value={settings.colors[job as keyof typeof CLASSES] ?? ""} own={c.color} set={(v) => change((s) => (s.colors = { ...s.colors, [job]: v }))} />
            </Line>
          )}
        </For>
      </Group>
      <Group name="Text">
        <Line name="Font"><Choices name="Font" all={FONTS.map((f) => [f, FONT_NAMES[f]] as const)} value={l().font} set={look("font")} /></Line>
        <Line name="Meter text size"><Slide name="Meter text size" least={0.8} most={1.4} step={0.05} value={l().size} text={percent(l().size)} set={look("size")} /></Line>
        <Line name="Outline of names"><Choices name="Outline of names" all={[["", "None"], ["soft", "Soft"], ["solid", "Solid"]] as const} value={l().outline} set={look("outline")} /></Line>
        <Switch name="Thin outline on all text" on={l().thin} set={look("thin")} />
      </Group>
      <Group name="See-through">
        <Line name="Background of overlays">
          <Slide name="Background of overlays" least={0.2} most={1} step={0.02} value={settings.overlay.opacity} text={percent(settings.overlay.opacity)} set={(v) => change((s) => (s.overlay.opacity = v))} />
        </Line>
        <Line name="Shade while locked" about="Darkness behind the meter."><Slide name="Shade while locked" least={0} most={1} step={0.05} value={l().shade} text={percent(l().shade)} set={look("shade")} /></Line>
        <Switch name="Stronger while locked" about="Text and bars of the meter." on={l().strong} set={look("strong")} />
      </Group>
    </>
  );
}

export function LookPage() {
  return (
    <Shell title="Meter look">
      <div class="look">
        <div><MeterGroups /></div>
        <aside class="look-now">
          <Preview width={settings.look.width}><MeterOverlay look={{ small: false }} /></Preview>
          <Preview width={settings.look.width}><MeterOverlay look={{ small: true }} /></Preview>
        </aside>
      </div>
    </Shell>
  );
}
