import { For } from "solid-js";
import { editOverlays } from "../api";
import { FEATURES } from "../features";
import { change, settings } from "../store";
import { FPS, place, STYLES } from "../store/settings";
import { Choices, Line, Slide } from "../ui/Line";
import { Switch } from "../ui/Switch";

const STYLE_NAMES = { bar: "Full bars", line: "Thin lines", table: "Table" } as const;

export function OverlaysPage() {
  return (
    <div class="page">
      <header class="page-head">
        <h1>Overlays</h1>
        <button class="ui-button" data-main aria-keyshortcuts={settings.hotkeys.edit} onClick={() => void editOverlays(true)}>
          <span class="ui-icon" aria-hidden="true">{""}</span>
          Move them
        </button>
      </header>
      <section class="block">
        <Switch name="Show overlays" about={settings.hotkeys.overlay || "No key"} on={settings.overlay.on} set={(on) => change((s) => (s.overlay.on = on))} />
        <Switch name="Only over the game" about="Hidden while another window is in front." on={settings.overlay.onlyInGame} set={(on) => change((s) => (s.overlay.onlyInGame = on))} />
        <Switch name="Hide when there is nothing to show" on={settings.overlay.hideEmpty} set={(on) => change((s) => (s.overlay.hideEmpty = on))} />
      </section>
      <section class="block">
        <h2>Which</h2>
        <For each={FEATURES.filter((f) => f.overlay)}>
          {(f) => {
            const at = () => place(settings.places[f.id], f.overlay!.place);
            return (
              <Switch
                name={f.name}
                about={f.overlay!.about}
                on={at().on}
                set={(on) => change((s) => (s.places = { ...s.places, [f.id]: { ...at(), on } }))}
              />
            );
          }}
        </For>
      </section>
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
        <Switch name="Share of the damage" on={settings.meter.share} set={(on) => change((s) => (s.meter.share = on))} />
        <Switch name="Total damage" on={settings.meter.total} set={(on) => change((s) => (s.meter.total = on))} />
        <Switch name="Class marks" on={settings.meter.icons} set={(on) => change((s) => (s.meter.icons = on))} />
        <Switch name="Hide other players' names" on={settings.meter.hideNames} set={(on) => change((s) => (s.meter.hideNames = on))} />
      </section>
    </div>
  );
}
