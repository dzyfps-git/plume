import { For, Show } from "solid-js";
import { openSoundsFolder } from "../../api";
import { change, settings } from "../../store";
import { ALERTS, type Alert, type AlertId } from "../../store/settings";
import { Group } from "../../ui/Group";
import { Line, Slide } from "../../ui/Line";
import { Switch } from "../../ui/Switch";
import { ALERT_NAMES } from "./logic";
import { refresh, SignalLines } from "./SignalLines";
import { play } from "./sound";
import { Voice } from "./Voice";

export function AlertsPage() {
  refresh();
  return (
    <div class="page">
      <header class="page-head">
        <h1>Alerts</h1>
      </header>
      <AlertGroups />
      <Voice />
      <section class="block">
        <h2>Your own sounds</h2>
        <Line name="Sound files" about="WAV, MP3, OGG, M4A or FLAC, up to 8 MB. They are offered wherever a sound is chosen.">
          <span class="ui-row">
            <button class="ui-button" onClick={() => void openSoundsFolder()}>Open their folder</button>
            <button class="ui-button" onClick={refresh}>Read it again</button>
          </span>
        </Line>
      </section>
    </div>
  );
}

/** What alerts, and how loud. */
export function AlertGroups() {
  const edit = (id: AlertId, to: Partial<Alert>) => change((s) => Object.assign(s.alerts[id], to));
  const mixed = () => ALERTS.filter((id) => settings.alerts[id].on && settings.alerts[id].sound);
  return (
    <>
      <Group name="What alerts">
        <For each={ALERTS}>
          {(id) => {
            const a = () => settings.alerts[id];
            const about = ALERT_NAMES[id];
            return (
              <>
                <Switch name={about.name} about={about.about} on={a().on} set={(on) => edit(id, { on })} />
                <Show when={a().on}>
                  <div class="ui-rise alert-more">
                    <Show when={about.value}>
                      {(name) => (
                        <Line name={name()}>
                          <Slide name={`${about.name}, below`} least={5} most={95} step={5} value={a().value} text={`${a().value}%`} set={(value) => edit(id, { value })} />
                        </Line>
                      )}
                    </Show>
                    <SignalLines of={a()} words={about.name} set={(to) => edit(id, to)} />
                    <Switch name="Show it large" about="In the Callouts overlay." on={a().banner} set={(banner) => edit(id, { banner })} />
                  </div>
                </Show>
              </>
            );
          }}
        </For>
      </Group>
      <Group name="Sound mixer" about="Each alert that is on and has a sound.">
        <For each={mixed()} fallback={<p class="ui-muted">No alert that is on has a sound.</p>}>
          {(id) => (
            <Line name={ALERT_NAMES[id].name}>
              <span class="ui-row">
                <Slide name={`Volume of ${ALERT_NAMES[id].name}`} least={0} most={1} step={0.05} value={settings.alerts[id].volume} text={`${Math.round(settings.alerts[id].volume * 100)}%`} set={(volume) => edit(id, { volume })} />
                <button class="ui-icon-button" aria-label={`Play ${ALERT_NAMES[id].name}`} onClick={() => void play(settings.alerts[id].sound, settings.alerts[id].volume)}>{"\ue768"}</button>
              </span>
            </Line>
          )}
        </For>
        <Switch name="All sounds off" on={settings.voice.mute} set={(on) => change((s) => (s.voice.mute = on))} />
      </Group>
    </>
  );
}
