import { onCleanup, Show, type JSX } from "solid-js";
import { AlertGroups } from "../features/alerts/Page";
import { Voice } from "../features/alerts/Voice";
import { query, setQuery } from "../ui/search";
import { MeterGroups } from "./Look";
import { OverlayGroups } from "./Overlays";
import { AppGroups } from "./Settings";

/** A page of settings, with a search over those of all pages. */
export function Shell(props: { title: string; action?: JSX.Element; children: JSX.Element }) {
  onCleanup(() => setQuery(""));
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
      <Show when={query()} fallback={props.children}>
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
