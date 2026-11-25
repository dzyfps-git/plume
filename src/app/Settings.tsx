import { createResource, createSignal, For, Show } from "solid-js";
import { appVersion, openEngineFolder, openPicturesFolder } from "../api";
import { health } from "../live/health";
import { engine, reads, state } from "../live/store";
import { change, settings, taken } from "../store";
import { ACCENTS, ACTIONS, TEXTS, type Action } from "../store/settings";
import { Choices, Line } from "../ui/Line";
import { pictureCount, readPicturesAgain } from "../ui/Pic";
import { Switch } from "../ui/Switch";
import { hotkey } from "./keys";
import { NAME } from "./brand";

const ACTION_NAMES: Record<Action, string> = {
  overlay: "Show or hide overlays",
  edit: "Move overlays",
  reset: "Start the fight again",
  view: "Next meter view",
  quick: "Turn overlays on and off",
};

export function SettingsPage() {
  const [version] = createResource(appVersion);
  const engineText = () => {
    const { status, message } = engine();
    if (status === "running") return `Running, version ${state()?.version ?? ""}, listening on ${state()?.devices ?? 0} network devices.`;
    return message || { off: "Off.", missing: "Not installed.", starting: "Starting.", failed: "Stopped." }[status];
  };
  return (
    <div class="page">
      <header class="page-head">
        <h1>Settings</h1>
      </header>
      <section class="block">
        <h2>Live data</h2>
        <Switch
          name="Live data"
          about="Reads a copy of the game's network traffic on this PC. Off means the engine does not run."
          on={settings.live}
          set={(on) => change((s) => (s.live = on))}
        />
        <Line name="Engine" about={engineText()} bad={["missing", "failed"].includes(engine().status)}>
          <button class="ui-button" onClick={() => void openEngineFolder()}>Open its folder</button>
        </Line>
        <Show when={reads()}>
          {(r) => (
            <ul class="lights" aria-label="What the engine reads">
              <For each={health(r())}>{(h) => <li data-light={h.light}>{h.name}<small>{h.about}</small></li>}</For>
            </ul>
          )}
        </Show>
      </section>
      <section class="block">
        <h2>Windows</h2>
        <Switch name="Start with Windows" about="In the tray, with no window." on={settings.startup} set={(on) => change((s) => (s.startup = on))} />
        <Switch name="Sleep while the game is closed" about="Gives the overlays' memory back until the game is there again." on={settings.sleep} set={(on) => change((s) => (s.sleep = on))} />
      </section>
      <section class="block">
        <h2>Keys over the game</h2>
        <For each={ACTIONS}>
          {(action) => (
            <Line name={ACTION_NAMES[action]} about={taken().includes(action) ? "Another app has this key." : undefined} bad>
              <Key value={settings.hotkeys[action]} name={ACTION_NAMES[action]} set={(v) => change((s) => (s.hotkeys[action] = v))} />
            </Line>
          )}
        </For>
      </section>
      <section class="block">
        <h2>Look</h2>
        <Line name="Theme">
          <Choices
            name="Theme"
            all={[["dark", "Dark"], ["light", "Light"], ["auto", "Follow Windows"]] as const}
            value={settings.theme}
            set={(v, from) => {
              window.House.theme(v, from);
              change((s) => (s.theme = v));
            }}
          />
        </Line>
        <Line name="Accent">
          <Choices
            name="Accent"
            all={ACCENTS.map((a) => [a, <span class="ui-swatch" data-accent={a} role="img" aria-label={a || "violet"} />] as const)}
            value={settings.accent}
            set={(v) => change((s) => (s.accent = v))}
          />
        </Line>
        <Line name="Text size">
          <Choices
            name="Text size"
            all={TEXTS.map((t) => [t as number, `${Math.round(t * 100)}%`] as const)}
            value={settings.text}
            set={(v) => change((s) => (s.text = v))}
          />
        </Line>
        <Switch
          name="Skill pictures"
          about={pictureCount() ? `${pictureCount()} pictures in your folder. Without one, letters stand in.` : "None in your folder yet, so letters stand in."}
          on={settings.pictures}
          set={(on) => change((s) => (s.pictures = on))}
        />
        <Line name="Picture folder">
          <div class="ui-row">
            <button class="ui-button" onClick={() => void openPicturesFolder()}>Open it</button>
            <button class="ui-button" onClick={readPicturesAgain}>Look again</button>
          </div>
        </Line>
        <Switch
          name="Colour-blind class colours"
          about="Classes stay apart for eyes that mix up red and green. Each class also has its own mark."
          on={settings.safeColors}
          set={(on) => change((s) => (s.safeColors = on))}
        />
      </section>
      <section class="block">
        <h2>About</h2>
        <p class="ui-muted">
          {NAME} {version()}. Not made or approved by NC. It sends nothing to the game and nothing to the internet. Other
          players' names stay in memory and are gone when it closes.
        </p>
      </section>
    </div>
  );
}

/** Press the keys to set them. Delete takes the key away, Escape leaves it. */
function Key(props: { value: string; name: string; set: (value: string) => void }) {
  const [listening, setListening] = createSignal(false);
  return (
    <button
      class="ui-button key"
      aria-label={`${props.name}: ${props.value || "no key"}`}
      aria-pressed={listening()}
      onClick={() => setListening(true)}
      onBlur={() => setListening(false)}
      onKeyDown={(e) => {
        if (!listening()) return;
        e.preventDefault();
        e.stopPropagation();
        const bare = !e.ctrlKey && !e.altKey && !e.shiftKey;
        const pressed = hotkey(e);
        if (bare && e.key === "Delete") props.set("");
        else if (pressed) props.set(pressed);
        else if (!(bare && e.key === "Escape")) return;
        setListening(false);
      }}
    >
      {listening() ? "Press the keys" : props.value || "No key"}
    </button>
  );
}
