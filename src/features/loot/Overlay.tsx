import { createResource, For, Show } from "solid-js";
import { settings } from "../../store";
import { full } from "../../ui/format";
import { alert } from "../alerts/Overlay";
import { itemFile } from "../map/data";
import { gradeOf, itemName, type ItemFile } from "./logic";
import { followLoot, fresh } from "./watch";
import "./loot.css";

const items = () => itemFile().catch(() => null);

/** Keeps loot, and sounds as a chosen item comes. */
export function followFeed() {
  followLoot((item) => {
    if (!settings.loot.rules.includes(item) || !settings.alerts.loot.on) return;
    // Through the Callouts, so "Show it large" is honoured as for every other alert.
    void items().then((file) => alert({ id: "loot", text: itemName(file, item) }));
  });
}

const shown = (file: ItemFile | null | undefined) =>
  fresh().filter((f) => settings.loot.rules.includes(f.item) || (file?.items[f.item]?.[1] ?? 0) >= settings.loot.least);

export const quiet = () => fresh().length === 0;

export function LootOverlay() {
  const [file] = createResource(items);
  return (
    <section class="loot-feed glass" aria-label="Loot">
      <For each={shown(file())}>
        {(f) => (
          <span class="loot-item" data-grade={gradeOf(file(), f.item) || undefined} data-chosen={settings.loot.rules.includes(f.item) || undefined}>
            {itemName(file(), f.item)} <span class="ui-num">x{full(f.count)}</span>
          </span>
        )}
      </For>
      <Show when={quiet()}><span class="ui-muted">Loot</span></Show>
    </section>
  );
}
