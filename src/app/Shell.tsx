import { createSignal, For, onCleanup, Show, type JSX } from "solid-js";
import { AlertGroups } from "../features/alerts/Page";
import { Voice } from "../features/alerts/Voice";
import { query, setQuery } from "../ui/search";
import { MeterGroups } from "./Look";
import { OverlayGroups } from "./Overlays";
import { AppGroups } from "./Settings";

/** A page of settings, with a search over those of all pages. */
export function Shell(props: { title: string; action?: JSX.Element; children: JSX.Element }) {
  onCleanup(() => setQuery(""));
  let body: HTMLDivElement | undefined;
  // Its groups, as chips that open one and go to it. The page is made again after a search, so each is looked up when pressed.
  const all = () => [...(body?.querySelectorAll<HTMLDetailsElement>("details.group") ?? [])];
  const [groups, setGroups] = createSignal<string[]>([]);
  const mounted = (el: HTMLDivElement) => {
    body = el;
    queueMicrotask(() => setGroups(all().map((g) => g.querySelector(":scope > summary h2")?.textContent ?? "")));
  };
  const jump = (at: number) => {
    const group = all()[at];
    if (!group) return;
    group.open = true;
    group.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div class="page">
      <header class="page-head">
        <h1>{props.title}</h1>
        <label class="ui-search settings-search">
          <span class="ui-icon" aria-hidden="true">{""}</span>
          <input type="search" placeholder="Search all settings" aria-label="Search all settings" onInput={(e) => setQuery(e.currentTarget.value)} />
        </label>
        {props.action}
      </header>
      <Show when={!query() && groups().length > 3}>
        <nav class="group-index ui-row" aria-label="On this page">
          <For each={groups()}>{(name, i) => <button class="ui-chip" onClick={() => jump(i())}>{name}</button>}</For>
        </nav>
      </Show>
      <Show when={query()} fallback={<div ref={mounted} class="shell-body">{props.children}</div>}>
        <div class="found">
          <MeterGroups still />
          <OverlayGroups still />
          <AlertGroups />
          <Voice />
          <AppGroups />
          <p class="found-none ui-muted">No setting matches.</p>
        </div>
      </Show>
    </div>
  );
}
