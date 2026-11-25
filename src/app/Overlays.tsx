import { For, Show } from "solid-js";
import { editOverlays } from "../api";
import { FEATURES } from "../features";
import { GROUPS, overlayName } from "../features/types";
import { change, settings } from "../store";
import { VIEW_NAMES } from "../features/meter/logic";
import { WHEN_NAMES } from "../overlay/rules";
import { FOOTER, FPS, place, rule, STYLES, VIEWS, WHEN, type Footer, type Rule, type View, type When } from "../store/settings";
import { CLASSES } from "../ui/classes";
import { Choices, Line, Slide } from "../ui/Line";
import { Switch } from "../ui/Switch";

const FOOTER_NAMES: Record<Footer, string> = { ping: "Ping", total: "Total", flight: "Flight", odyle: "Odyle Energy", entries: "Tickets", kina: "Kina today", points: "Abyss Points" };
const STYLE_NAMES = { bar: "Full bars", line: "Lines of light", cards: "Cards", table: "Table" } as const;

export function OverlaysPage() {
  return (
    <div class="page">
      <header class="page-head">
        <h1>Overlays</h1>
        <button class="ui-button" data-main aria-keyshortcuts={settings.hotkeys.edit} onClick={() => void editOverlays("move")}>
          <span class="ui-icon" aria-hidden="true">{""}</span>
          Move them
        </button>
      </header>
      <section class="block">
        <Switch name="Show overlays" about={settings.hotkeys.overlay || "No key"} on={settings.overlay.on} set={(on) => change((s) => (s.overlay.on = on))} />
        <Switch name="Only over the game" about="Hidden while another window is in front." on={settings.overlay.onlyInGame} set={(on) => change((s) => (s.overlay.onlyInGame = on))} />
        <Switch name="Hide when there is nothing to show" on={settings.overlay.hideEmpty} set={(on) => change((s) => (s.overlay.hideEmpty = on))} />
      </section>
      <For each={GROUPS}>
        {(group) => (
          <section class="block">
            <h2>{group}</h2>
            <For each={FEATURES.filter((f) => f.overlay?.group === group)}>
              {(f) => {
                const at = () => place(settings.places[f.id], f.overlay!.place);
                return (
                  <>
                    <Switch
                      name={overlayName(f)}
                      about={f.overlay!.about}
                      on={at().on}
                      set={(on) => change((s) => (s.places = { ...s.places, [f.id]: { ...at(), on } }))}
                    />
                    <Show when={at().on}>
                      <ShowRule id={f.id} name={overlayName(f)} />
                    </Show>
                  </>
                );
              }}
            </For>
          </section>
        )}
      </For>
      <section class="block">
        <h2>Look</h2>
        <Line name="Background">
          <Slide
            name="Background" least={0.2} most={1} step={0.02}
            value={settings.overlay.opacity}
            text={`${Math.round(settings.overlay.opacity * 100)}%`}
            set={(v) => change((s) => (s.overlay.opacity = v))}
          />
        </Line>
        <Line name="Bar movement" about="Frames a second. Higher is smoother and costs more.">
          <Choices
            name="Bar movement"
            all={FPS.map((n) => [n, n ? String(n) : "Screen"] as const)}
            value={settings.fps}
            set={(n) => change((s) => (s.fps = n))}
          />
        </Line>
        <Line name="Numbers change every" about="Shorter is more live and costs more.">
          <Slide
            name="Numbers change every" least={50} most={1000} step={50}
            value={settings.updateMs}
            text={`${settings.updateMs} ms`}
            set={(v) => change((s) => (s.updateMs = v))}
          />
        </Line>
      </section>
      <section class="block">
        <h2>Damage meter</h2>
        <Line name="Style">
          <Choices name="Style" all={STYLES.map((s) => [s, STYLE_NAMES[s]] as const)} value={settings.meter.style} set={(v) => change((s) => (s.meter.style = v))} />
        </Line>
        <Line name="Rows" about="Yours always shows.">
          <Slide name="Rows" least={1} most={24} step={1} value={settings.meter.rows} text={String(settings.meter.rows)} set={(v) => change((s) => (s.meter.rows = v))} />
        </Line>
        <Line name="Edge that stays put" about="As rows come and go.">
          <Choices name="Edge that stays put" all={[["top", "Top"], ["bottom", "Bottom"]] as const} value={settings.meter.edge} set={(v) => change((s) => (s.meter.edge = v))} />
        </Line>
        <Line name="Shows" about={settings.hotkeys.view ? `${settings.hotkeys.view} goes to the next.` : undefined}>
          <select class="ui-select" aria-label="What the meter shows" value={settings.meter.view} onChange={(e) => change((s) => (s.meter.view = e.currentTarget.value as View))}>
            <For each={VIEWS}>{(view) => <option value={view}>{VIEW_NAMES[view]}</option>}</For>
          </select>
        </Line>
        <Switch name="Share of the damage" on={settings.meter.share} set={(on) => change((s) => (s.meter.share = on))} />
        <Switch name="Total damage" on={settings.meter.total} set={(on) => change((s) => (s.meter.total = on))} />
        <Switch name="Boss health" about="Above the rows, with its stagger gauge and how long until it falls." on={settings.meter.boss} set={(on) => change((s) => (s.meter.boss = on))} />
        <Switch name="Your best as a row" about="Where your best fight of this target would be by now." on={settings.meter.ghost} set={(on) => change((s) => (s.meter.ghost = on))} />
        <Switch name="Your pull" about="Which try it is, and how it goes against your best." on={settings.meter.head} set={(on) => change((s) => (s.meter.head = on))} />
        <Switch name="Combat Power" about="Small, beside each name. Other players' is never written down." on={settings.meter.power} set={(on) => change((s) => (s.meter.power = on))} />
        <Switch name="Class marks" on={settings.meter.icons} set={(on) => change((s) => (s.meter.icons = on))} />
        <Switch name="Hide other players' names" about="In every overlay." on={settings.meter.hideNames} set={(on) => change((s) => (s.meter.hideNames = on))} />
        <Line name="Footer" about="A line under the bars.">
          <div class="ui-row" role="group" aria-label="Footer">
            <For each={FOOTER}>
              {(f) => (
                <button
                  class="ui-chip"
                  aria-pressed={settings.meter.footer.includes(f)}
                  onClick={() => change((s) => (s.meter.footer = s.meter.footer.includes(f) ? s.meter.footer.filter((x) => x !== f) : [...s.meter.footer, f]))}
                >
                  {FOOTER_NAMES[f]}
                </button>
              )}
            </For>
          </div>
        </Line>
      </section>
    </div>
  );
}

/** When one overlay may show, and for which class. */
function ShowRule(props: { id: string; name: string }) {
  const now = () => rule(settings.rules[props.id]);
  const set = (to: Partial<Rule>) => change((s) => (s.rules = { ...s.rules, [props.id]: { ...now(), ...to } }));
  return (
    <div class="show-rule">
      <select class="ui-select" aria-label={`When ${props.name} shows`} value={now().when} onChange={(e) => set({ when: e.currentTarget.value as When })}>
        <For each={WHEN}>{(w) => <option value={w}>{WHEN_NAMES[w]}</option>}</For>
      </select>
      <select class="ui-select" aria-label={`Class ${props.name} shows for`} value={now().job} onChange={(e) => set({ job: e.currentTarget.value as Rule["job"] })}>
        <option value="">Every class</option>
        <For each={Object.entries(CLASSES)}>{([job, c]) => <option value={job}>{c.name}</option>}</For>
      </select>
    </div>
  );
}
