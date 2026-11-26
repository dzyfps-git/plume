import { createSignal, For, Show } from "solid-js";
import { unwrap } from "solid-js/store";
import { FEATURES } from "../features";
import { overlayName, widthOf, type Feature } from "../features/types";
import { fromCode, MARGIN, snap, toCode, toPixels, toShare } from "../overlay/layout";
import { change, settings } from "../store";
import { ACTIVITIES, place, type Layout, type Place } from "../store/settings";
import { Group } from "../ui/Group";
import { Line } from "../ui/Line";
import { Switch } from "../ui/Switch";

const ACTIVITY_NAMES: Record<Layout["when"], string> = { "": "Any activity", solo: "Alone", party: "In a party", force: "In a Force", pvp: "Against players", dummy: "On a dummy" };
/** The screen the picture stands for. Places are shares of it, so any screen gives the same picture. */
const SCREEN = { width: 1920, height: 1080 };
/** A picture of your screen behind the boxes, small, on this PC. */
const PICTURE = "screen-picture";
const [picture, setPicture] = createSignal(localStorage.getItem(PICTURE) ?? "");


export function LayoutGroup() {
  const [code, setCode] = createSignal("");
  const [said, setSaid] = createSignal("");
  const edit = (i: number, to: Partial<Layout>) => change((s) => (s.layouts[i] = { ...s.layouts[i], ...to }));
  const add = (places: Record<string, Place>, name: string) => change((s) => (s.layouts = [...s.layouts, { name, places: structuredClone(unwrap(places)), when: "", who: "" }]));
  const bring = () => {
    const places = fromCode(code());
    if (!places) return setSaid("That is not a layout code.");
    add(places, "Given layout");
    setCode("");
    setSaid("Brought in. Wear it, or give it an activity.");
  };
  const copy = (l: Layout) => void navigator.clipboard.writeText(toCode(l.places)).then(() => setSaid(`The code of ${l.name} is copied.`), () => setSaid("Could not copy."));

  return (
    <Group name="Layouts">
      <Switch name="Change by themselves" about="As the activity and the character of a layout say. Moving an overlay by hand holds until what fits changes." on={settings.layoutAuto} set={(on) => change((s) => (s.layoutAuto = on))} />
      <Line name="These places" about="Saves where every overlay is now, and which are on.">
        <button class="ui-button" onClick={() => add(settings.places, `Layout ${settings.layouts.length + 1}`)}>Save as a layout</button>
      </Line>
      <For each={settings.layouts}>
        {(l, i) => (
          <div class="layout-row">
            <input class="ui-input" aria-label="Name of the layout" value={l.name} maxLength={40} onChange={(e) => edit(i(), { name: e.currentTarget.value.trim() || l.name })} />
            <select class="ui-select" aria-label={`When ${l.name} comes`} value={l.when} onChange={(e) => edit(i(), { when: e.currentTarget.value as Layout["when"] })}>
              <For each={["", ...ACTIVITIES] as Layout["when"][]}>{(a) => <option value={a}>{ACTIVITY_NAMES[a]}</option>}</For>
            </select>
            <input class="ui-input" aria-label={`Character of ${l.name}, empty for any`} placeholder="Any character" value={l.who} maxLength={40} onChange={(e) => edit(i(), { who: e.currentTarget.value.trim() })} />
            <button class="ui-button" onClick={() => change((s) => (s.places = structuredClone(unwrap(l.places))))}>Wear</button>
            <button class="ui-button" onClick={() => copy(l)}>Copy code</button>
            <button class="ui-button" onClick={() => change((s) => (s.layouts = s.layouts.filter((_, at) => at !== i())))}>Delete</button>
          </div>
        )}
      </For>
      <Line name="A layout someone gave you">
        <div class="ui-row">
          <input class="ui-input" aria-label="Layout code" placeholder="plume:..." value={code()} onInput={(e) => setCode(e.currentTarget.value)} />
          <button class="ui-button" disabled={!code().trim()} onClick={bring}>Bring in</button>
        </div>
      </Line>
      <Show when={said()}><p class="ui-muted ui-small" role="status">{said()}</p></Show>
    </Group>
  );
}

/** The overlays as boxes on a picture of the screen, to move with the mouse. */
export function ScreenMap() {
  const [grid, setGrid] = createSignal(true);
  let box!: HTMLDivElement;
  const all = () => FEATURES.filter((f) => f.overlay);
  const at = (f: Feature) => place(settings.places[f.id], f.overlay!.place);
  const size = (f: Feature) => {
    const k = at(f).scale * settings.overlay.size;
    return { width: widthOf(f.overlay!) * k, height: (at(f).height ?? 120) * k };
  };
  const spot = (f: Feature) => toPixels(at(f), size(f), SCREEN);
  const others = (f: Feature) => all().filter((o) => o !== f && at(o).on).map((o) => ({ ...spot(o), ...size(o) }));

  const drag = (f: Feature, e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const k = SCREEN.width / box.clientWidth;
    const [from, was] = [{ x: e.clientX, y: e.clientY }, spot(f)];
    const moveTo = (m: PointerEvent) => {
      const raw = { x: was.x + (m.clientX - from.x) * k, y: was.y + (m.clientY - from.y) * k };
      const put = grid() && !m.altKey ? snap(raw, size(f), SCREEN, others(f)) : raw;
      const share = toShare(put, size(f), SCREEN);
      change((s) => (s.places = { ...s.places, [f.id]: { ...at(f), ...share } }));
    };
    const end = () => {
      el.removeEventListener("pointermove", moveTo);
      el.removeEventListener("pointerup", end);
    };
    el.addEventListener("pointermove", moveTo);
    el.addEventListener("pointerup", end);
  };

  const choose = (file: File | undefined) => {
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      // Small enough to keep: 960 points wide.
      const canvas = document.createElement("canvas");
      canvas.width = 960;
      canvas.height = Math.round((960 * image.height) / image.width);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/jpeg", 0.8);
      URL.revokeObjectURL(image.src);
      try {
        localStorage.setItem(PICTURE, url);
      } catch {
        // Too large to keep: it shows until the window closes.
      }
      setPicture(url);
    };
    image.src = URL.createObjectURL(file);
  };

  return (
    <Group name="On a picture of the screen" about="Drag a box to move its overlay. Alt drags freely. The game's own screen is the one that counts: check it there.">
      <div class="ui-row">
        <Switch name="Snap to the grid and to each other" on={grid()} set={setGrid} />
        <label class="ui-button">
          Choose a screenshot
          <input type="file" accept="image/*" hidden onChange={(e) => choose(e.currentTarget.files?.[0])} />
        </label>
        <Show when={picture()}>
          <button class="ui-button" onClick={() => (localStorage.removeItem(PICTURE), setPicture(""))}>No picture</button>
        </Show>
      </div>
      <div ref={box} class="screen-map" data-grid={grid() || undefined} style={{ "background-image": picture() ? `url(${picture()})` : undefined, "--margin": `${(MARGIN / SCREEN.width) * 100}%` }}>
        <For each={all().filter((f) => at(f).on)}>
          {(f) => (
            <button
              class="screen-box"
              style={{
                left: `${(spot(f).x / SCREEN.width) * 100}%`,
                top: `${(spot(f).y / SCREEN.height) * 100}%`,
                width: `${(size(f).width / SCREEN.width) * 100}%`,
                height: `${(size(f).height / SCREEN.height) * 100}%`,
              }}
              aria-label={`${overlayName(f)}: drag to move`}
              onPointerDown={(e) => drag(f, e)}
            >
              {overlayName(f)}
            </button>
          )}
        </For>
      </div>
    </Group>
  );
}
