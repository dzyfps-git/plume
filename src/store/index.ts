import { createSignal } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import { on, saveSettings } from "../api";
import { barEase, read, type Settings } from "./settings";
import "./still.css";
import "./names.css";

const [settings, setSettings] = createStore<Settings>(read(null));
/** Actions whose key another app already has. */
const [taken, setTaken] = createSignal<string[]>([]);

export { settings, taken };

const root = document.documentElement;
const dark = matchMedia("(prefers-color-scheme: dark)");

/** The look that comes from the settings. An overlay is always dark: it lies over the game. */
function wear(overlay: boolean) {
  const theme = settings.theme === "auto" ? (dark.matches ? "dark" : "light") : settings.theme;
  root.dataset.theme = overlay ? "dark" : theme;
  if (!overlay) root.style.setProperty("zoom", String(settings.text));
  root.style.setProperty("--bar-time", `${settings.updateMs}ms`);
  root.style.setProperty("--bar-ease", barEase(settings.fps, settings.updateMs));
  root.style.setProperty("--tint", String(settings.overlay.opacity));
  root.toggleAttribute("data-still", !settings.motion);
}

export async function useSettings(saved: unknown, overlay = false) {
  setSettings(reconcile(read(saved)));
  wear(overlay);
  dark.addEventListener("change", () => wear(overlay));
  await on("settings", (value) => {
    setSettings(reconcile(read(value)));
    wear(overlay);
  });
  // The first start writes the defaults, which also turns the keys and the engine on.
  if (!saved && !overlay) await keep();
}

async function keep() {
  try {
    setTaken(await saveSettings(unwrap(settings)));
  } catch (failure) {
    console.error(failure);
  }
}

/** Whose names are hidden: nobody's, others', or everyone's. */
export const hideNames = (): boolean | "all" => (settings.discreet ? "all" : settings.meter.hideNames);
/** The look you chose for a name, while names show: a hidden name keeps no look that could tell who it is. */
export const nameStyle = (name: string) => (hideNames() || !name ? undefined : settings.names[name]);

/** Writes the settings down now, not once the changing stops. */
export function keepNow() {
  clearTimeout(timer);
  return keep();
}

let timer = 0;
/** Changes settings now, and writes them down once the changing stops. */
export function change(edit: (s: Settings) => void, overlay = false) {
  const next = structuredClone(unwrap(settings));
  edit(next);
  setSettings(reconcile(read(next)));
  wear(overlay);
  clearTimeout(timer);
  timer = window.setTimeout(keep, 150);
}
