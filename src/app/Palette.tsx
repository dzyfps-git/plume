import { createEffect, createMemo, createSignal, For, onMount } from "solid-js";
import { editOverlays, engineSend } from "../api";
import { change, settings } from "../store";
import type { Page } from "./App";

interface Item {
  name: string;
  icon: string;
  run: () => void;
}

export function Palette(props: { pages: Page[]; go: (page: Page) => void; close: () => void }) {
  let dialog!: HTMLDialogElement;
  let mark!: HTMLLIElement;
  const rows: HTMLLIElement[] = [];
  const [words, setWords] = createSignal("");
  const [at, setAt] = createSignal(0);

  const items: Item[] = [
    ...props.pages.map((p) => ({ name: p.name, icon: p.icon, run: () => props.go(p) })),
    { name: "Move the overlays", icon: "", run: () => void editOverlays(true) },
    { name: "Start the fight again", icon: "", run: () => void engineSend({ cmd: "reset" }) },
    {
      name: settings.overlay.on ? "Hide the overlays" : "Show the overlays",
      icon: "",
      run: () => change((s) => (s.overlay.on = !s.overlay.on)),
    },
    {
      name: settings.live ? "Turn off live data" : "Turn on live data",
      icon: "",
      run: () => change((s) => (s.live = !s.live)),
    },
  ];
  const found = createMemo(() => {
    const parts = words().toLowerCase().split(/\s+/);
    return items.filter(({ name }) => parts.every((p) => name.toLowerCase().includes(p)));
  });

  onMount(() => dialog.showModal());
  createEffect(() => window.House.glideTo(mark, found().length ? rows[at()] : undefined));

  const run = (item: Item | undefined) => {
    if (!item) return;
    props.close();
    item.run();
  };
  const keys = (e: KeyboardEvent) => {
    const by = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (by && found().length) setAt((at() + by + found().length) % found().length);
    else if (e.key === "Enter") run(found()[at()]);
    else return;
    e.preventDefault();
  };

  return (
    <dialog
      ref={dialog}
      class="ui-palette palette"
      aria-label="Find a page or an action"
      onClose={props.close}
      onClick={(e) => e.target === dialog && props.close()}
      onKeyDown={keys}
    >
      <input
        autofocus
        placeholder="Find a page or an action"
        role="combobox"
        aria-expanded="true"
        aria-controls="found"
        aria-activedescendant={found().length ? `found-${at()}` : undefined}
        onInput={(e) => {
          setWords(e.currentTarget.value.trim());
          setAt(0);
        }}
      />
      <ul id="found" role="listbox">
        <li ref={mark} class="ui-glide" aria-hidden="true" />
        <For each={found()}>
          {(item, i) => (
            <li
              ref={(el) => (rows[i()] = el)}
              id={`found-${i()}`}
              role="option"
              aria-selected={i() === at()}
              onPointerMove={() => setAt(i())}
              onClick={() => run(item)}
            >
              <span class="ui-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.name}</span>
            </li>
          )}
        </For>
      </ul>
    </dialog>
  );
}
