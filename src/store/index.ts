import { createSignal } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import { on, saveSettings } from "../api";
import { barEase, read, type Settings } from "./settings";

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
  if (settings.accent) root.dataset.accent = settings.accent;
  else delete root.dataset.accent;
  root.style.setProperty("--bar-time", `${settings.updateMs}ms`);
  root.style.setProperty("--bar-ease", barEase(settings.fps, settings.updateMs));
  root.style.setProperty("--tint", String(settings.overlay.opacity));
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
