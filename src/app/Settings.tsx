import { createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { FEATURES } from "../features";
import { appVersion, backup, cost, openDataFolder, shareData, openEngineFolder, openPicturesFolder, openRecordingsFolder, restore } from "../api";
import { health } from "../live/health";
import { engine, near, reads, state } from "../live/store";
import { change, settings, taken } from "../store";
import { ACCENTS, ACTIONS, KEEP, read, TEXTS, type Action } from "../store/settings";
import { Group } from "../ui/Group";
import { Choices, Colour, Line } from "../ui/Line";
import { pictureCount, readPicturesAgain } from "../ui/Pic";
import { Switch } from "../ui/Switch";
import { classOf } from "../ui/classes";
import { NAME } from "./brand";
import { hotkey } from "./keys";
import { Shell } from "./Shell";

const ACTION_NAMES: Record<Action, string> = {
  overlay: "Show or hide overlays",
  edit: "Move overlays",
  reset: "Start the fight again",
  view: "Next meter view",
  quick: "Overlay controls",
  compact: "Meter as one bar",
  lock: "Lock or unlock the meter",
  peek: "Look closer, while held",
  discreet: "Hide names and Combat Power",
  history: "Open History",
  details: "Open the last fight",
  settings: "Open Settings",
  buffs: "Buffs on or off",
  actions: "Action bars on or off",
  second: "Second screen",
  stopwatch: "Stopwatch: start, stop, go on",
};

/** What came with this version, newest first. */
const NEWS = [
  "A grade for every kill and every dummy run, against your own: grey to violet, and gold for a new best.",
  "Your best kill on the boss bar: where its health was by now, and how many seconds you are ahead.",
  "Splits for dungeon runs, against your best run of that dungeon.",
  "A page for another screen. Choose its parts on the Overlays page, and give it a key.",
  "Records: your biggest hit with each skill, your fastest kills, and streaks, in History.",
  "The card at the end says your grade, whether your bursts were on time, and one thing to do better.",
  "Odyle Energy as time, by how long your runs take.",
  "The meter is one bar out of fights, and opens with the next one.",
  "Buttons on the meter, for while it is locked and while it is not. A panel over the game: Ctrl+Alt+F8.",
  "Gauges as a fifth style, four themes, four fonts, outlines, and your own colour for every class and meaning.",
  "Gap to the next place, bursts, the dead, your last casts, item level, crit and back attacks.",
  "Hold a key to look closer. It has none until you set one.",
  "Party frames with every part to choose, and Force frames in a place of their own.",
  "Odyle Energy in parts, with its cap, a ring until more comes, and a word when it is nearly full.",
  "Training begins by itself at the first hit on a dummy.",
  "Undo while moving overlays, a search over all settings, a backup in one file.",
];

export function SettingsPage() {
  return <Shell title="Settings"><AppGroups /></Shell>;
}

export function AppGroups() {
  const [version] = createResource(appVersion);
  const [shared, setShared] = createSignal("");
  const engineText = () => {
    const { status, message } = engine();
    if (status === "running") return `Running, version ${state()?.version ?? ""}, listening on ${state()?.devices ?? 0} network devices.`;
    return message || { off: "Off.", missing: "Not installed.", starting: "Starting.", failed: "Stopped." }[status];
  };
  return (
    <>
      <Group name="Live data">
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
      </Group>
      <Group name="Windows">
        <Switch name="Start with Windows" about="In the tray, with no window." on={settings.startup} set={(on) => change((s) => (s.startup = on))} />
        <Switch name="Sleep while the game is closed" about="Gives the overlays' memory back until the game is there again." on={settings.sleep} set={(on) => change((s) => (s.sleep = on))} />
        <Line name="Closing this window">
          <Choices name="Closing this window" all={[["tray", "Keeps the overlays, in the tray"], ["quit", "Quits Plume"]] as const} value={settings.close} set={(v) => change((s) => ((s.close = v), (s.closeAsked = true)))} />
        </Line>
        <Line name="As the game starts" about="This page opens, minimized if the window was closed, so the game keeps the screen.">
          <select class="ui-select" aria-label="Page that opens as the game starts" value={settings.gameOpens} onChange={(e) => change((s) => (s.gameOpens = e.currentTarget.value))}>
            <option value="">Nothing opens</option>
            <For each={FEATURES.filter((f) => f.page)}>{(f) => <option value={f.id}>{f.name}</option>}</For>
          </select>
        </Line>
      </Group>
      <Performance />
      <Group name="Keys over the game">
        <For each={ACTIONS}>
          {(action) => (
            <Line name={ACTION_NAMES[action]} about={taken().includes(action) ? "Another app has this key." : undefined} bad>
              <Key value={settings.hotkeys[action]} name={ACTION_NAMES[action]} set={(v) => change((s) => (s.hotkeys[action] = v))} />
            </Line>
          )}
        </For>
      </Group>
      <Group name="Look">
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
        <Line name="Accent" wide>
          <span class="ui-row">
            <Choices
              name="Accent"
              all={[...ACCENTS.map((a) => [a as string, <span class="ui-swatch" data-accent={a} role="img" aria-label={a || "violet"} />] as const), ["class", "Your class"] as const]}
              value={settings.accent}
              set={(v) => change((s) => (s.accent = v))}
            />
            <Colour name="Accent of your own" value={settings.accent.startsWith("#") ? settings.accent : ""} own={settings.accent === "class" ? classOf(near.you?.job ?? "").color : "var(--accent)"} set={(v) => change((s) => (s.accent = v))} />
          </span>
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
      </Group>
      <Group name="History and backup">
        <Line name="Fights to keep" about="Older ones are deleted as new ones come. Fewer than you have deletes them with the next fight.">
          <Choices name="Fights to keep" all={KEEP.map((n) => [n as number, n ? String(n) : "All"] as const)} value={settings.fights.keep} set={(n) => change((s) => (s.fights.keep = n))} />
        </Line>
        <Backup />
      </Group>
      <Group name="Bug reports">
        <Switch
          name="Record the session"
          about="Writes what the engine reads into a file on this PC, at most 256 MB. It also holds what other players around you did, so look twice before you give it to anyone."
          on={settings.record}
          set={(on) => change((s) => (s.record = on))}
        />
        <Line name="Recordings"><button class="ui-button" onClick={() => void openRecordingsFolder()}>Open their folder</button></Line>
      </Group>
      <div id="news">
        <Group name="What is new">
          <ul class="news"><For each={NEWS}>{(n) => <li>{n}</li>}</For></ul>
        </Group>
      </div>
      <Group name="About">
        <p class="ui-muted">
          {NAME} {version()}. Not made or approved by NC. It sends nothing to the game and nothing to the internet. Other
          players' names stay in memory and are gone when it closes.
        </p>
        <Line name="Maps, names and pictures" about="Made from public data on this PC and kept out of the installer. A friend puts the two folders you give them into their data folder.">
          <div class="ui-row">
            <button class="ui-button" onClick={() => void shareData().then((n) => setShared(`${n.toLocaleString("en-GB")} files copied to the Desktop.`), (e) => setShared(String(e)))}>Copy for a friend</button>
            <button class="ui-button" onClick={() => void openDataFolder()}>Open the data folder</button>
          </div>
        </Line>
        <Show when={shared()}><p class="ui-muted ui-small" role="status">{shared()}</p></Show>
      </Group>
    </>
  );
}

/** Everything of yours in one file, and back from one. */
function Backup() {
  const [found, setFound] = createSignal<{ name: string; value: { settings: unknown; fights: unknown[] } }>();
  const [said, setSaid] = createSignal<{ text: string; bad?: boolean }>();
  const told = (failure: unknown) => setSaid({ text: String(failure), bad: true });
  const pick = async (file: File | undefined) => {
    setFound();
    setSaid();
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      if (value?.plume !== 1 || !Array.isArray(value.fights) || !value.settings) throw "This is not a backup of Plume.";
      setFound({ name: file.name, value: { ...value, settings: read(value.settings) } });
    } catch (failure) {
      told(failure instanceof SyntaxError ? "This is not a backup of Plume." : failure);
    }
  };
  const bring = () => {
    const from = found()!;
    setFound();
    restore(from.value).then((n) => setSaid({ text: `Settings are back, with ${n} of ${from.value.fights.length} fights.${n < from.value.fights.length ? " The rest were here already, or there was no room under how many fights are kept: none of yours were let go." : ""}` }), told);
  };
  return (
    <>
      <Line name="Backup" about="Settings, boss plans and your own part of every fight, in one file in Downloads.">
        <button class="ui-button" onClick={() => backup(`plume-backup-${new Date().toISOString().slice(0, 10)}.json`).then(() => setSaid({ text: "Saved in Downloads." }), told)}>Save a backup</button>
      </Line>
      <Line name="Bring a backup back" about={said()?.text} bad={said()?.bad}>
        <Show
          when={found()}
          fallback={
            <label class="ui-button">
              Choose a file
              <input class="unseen" type="file" accept=".json" aria-label="Backup file" onChange={(e) => {
                void pick(e.currentTarget.files?.[0]);
                e.currentTarget.value = "";
              }} />
            </label>
          }
        >
          {(f) => (
            <span class="ui-row">
              <small class="ui-muted">{f().name}: takes the place of your settings, and adds {f().value.fights.length} fights.</small>
              <button class="ui-button" onClick={() => setFound()}>Cancel</button>
              <button class="ui-button" data-main onClick={bring}>Bring it back</button>
            </span>
          )}
        </Show>
      </Line>
    </>
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

/** What Plume costs, and what makes it cost less. */
function Performance() {
  const [now, setNow] = createSignal<{ cpu: number; light: boolean }>();
  const look = () => void cost().then(setNow, () => setNow(undefined));
  look();
  const timer = setInterval(look, 5000);
  onCleanup(() => clearInterval(timer));
  return (
    <Group name="Performance">
      <Line name="What Plume takes now" about="Of the whole CPU, over the last five seconds: Plume's own process. Its windows run in WebView2 and the engine apart, which Task Manager shows.">
        <span class="ui-num">{now() ? `${now()!.cpu.toFixed(1)}%${now()!.light ? ", made lighter" : ""}` : "Measuring"}</span>
      </Line>
      <Switch name="Animations" about="Off, nothing moves by itself: pages, overlays and bars change at once." on={settings.motion} set={(on) => change((s) => (s.motion = on))} />
      <Switch name="Lighter by itself" about="While Plume's own process takes more than 6% of the CPU, numbers change once a second, until it takes less than 3%." on={settings.lighten} set={(on) => change((s) => (s.lighten = on))} />
      <p class="ui-muted ui-small">Bar movement in frames a second and how often numbers change are under Overlays.</p>
    </Group>
  );
}
