import { createSignal, For, onCleanup, Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { appWindow } from "../api";
import { FEATURES } from "../features";
import { engine, live } from "../live/store";
import { GAME, NAME } from "./brand";
import { OverlaysPage } from "./Overlays";
import { Palette } from "./Palette";
import { SettingsPage } from "./Settings";

export interface Page {
  id: string;
  name: string;
  icon: string;
  color?: string;
  view: Component;
}

const PAGES: Page[] = [
  ...FEATURES.flatMap(({ id, name, icon, color, page }) => (page ? [{ id, name, icon, color, view: page }] : [])),
  { id: "overlays", name: "Overlays", icon: "", color: "#8f9bff", view: OverlaysPage },
  { id: "settings", name: "Settings", icon: "", color: "#a9b4c8", view: SettingsPage },
];

export function App() {
  const [page, setPage] = createSignal(PAGES[0]);
  const [folded, setFolded] = createSignal(false);
  const [palette, setPalette] = createSignal(false);
  const go = (next: Page) => next !== page() && window.House.morph(() => setPage(next), "page");

  const keys = (e: KeyboardEvent) => {
    if (!e.ctrlKey || e.altKey || e.shiftKey) return;
    const at = Number(e.key) - 1;
    if (e.key === "k") setPalette((open) => !open);
    else if (e.key === ",") go(PAGES[PAGES.length - 1]);
    else if (PAGES[at]) go(PAGES[at]);
    else return;
    e.preventDefault();
  };
  addEventListener("keydown", keys);
  onCleanup(() => removeEventListener("keydown", keys));

  const status = () => {
    if (live()) return [`${GAME} connected`, "live"];
    return {
      off: ["Live data off", "off"],
      missing: ["Engine not installed", "bad"],
      failed: ["Engine stopped", "bad"],
      starting: ["Starting", "off"],
      running: [`Waiting for ${GAME}`, "off"],
    }[engine().status];
  };

  return (
    <div class="ui-shell">
      <header class="ui-titlebar" data-tauri-drag-region>
        <span class="ui-logo" data-tauri-drag-region>{NAME}</span>
        <button class="find" aria-keyshortcuts="Control+K" aria-label="Find a page or an action" onClick={() => setPalette(true)}>
          <span class="ui-icon" aria-hidden="true">{""}</span>
          Find
          <span class="ui-keys"><kbd>Ctrl</kbd><kbd>K</kbd></span>
        </button>
        <span class="status" data-state={status()[1]} role="status">{status()[0]}</span>
        <button class="ui-icon-button caption" aria-label="Minimize" onClick={() => void appWindow().minimize()}>{""}</button>
        <button class="ui-icon-button caption" aria-label="Maximize" onClick={() => void appWindow().toggleMaximize()}>{""}</button>
        <button class="ui-icon-button caption" aria-label="Close. Overlays stay on" onClick={() => void appWindow().close()}>{""}</button>
      </header>
      <nav class="ui-nav" data-rail={folded() || undefined} aria-label="Pages">
        <button class="ui-nav-item" aria-label={folded() ? "Open the menu" : undefined} onClick={() => setFolded(!folded())}>
          <span class="ui-icon" aria-hidden="true">{""}</span>
          <span>Fold</span>
        </button>
        <For each={PAGES}>
          {(p, i) => (
            <button
              class="ui-nav-item"
              data-last={p.id === "overlays" || undefined}
              aria-current={page() === p ? "page" : undefined}
              aria-keyshortcuts={`Control+${i() + 1}`}
              data-tip={folded() ? p.name : undefined}
              onClick={() => go(p)}
            >
              <span class="ui-icon" aria-hidden="true" style={{ "--icon-color": p.color }}>{p.icon}</span>
              <span>{p.name}</span>
            </button>
          )}
        </For>
      </nav>
      <main class="ui-main">
        <section class="ui-panel scroll" data-active>
          <Dynamic component={page().view} />
        </section>
      </main>
      <Show when={palette()}>
        <Palette pages={PAGES} go={go} close={() => setPalette(false)} />
      </Show>
    </div>
  );
}
