import { createMemo, For, Show } from "solid-js";
import { place } from "../../live/store";
import { settings } from "../../store";
import { MapCanvas } from "./Canvas";
import { useMap, useYou } from "./data";
import { far, height, keyOf, LAYER_COLOURS, nearest, type Near } from "./logic";
import "./map.css";

/** Nothing to show until the game says where you are. */
export const nowhere = () => !place()?.known;

/** A small map around you, with what you track. */
export function TrackerMapOverlay() {
  const you = useYou();
  const { map, picture } = useMap(() => you()?.map ?? 0);
  const tracked = createMemo(() => new Set(settings.world.tracked));
  return (
    <section class="tracker-map glass" aria-label="Tracker Map">
      <Show when={map() && you()?.known} fallback={<small class="ui-muted">Tracker Map</small>}>
        <MapCanvas map={map()!} picture={picture()} layers={settings.world.layers} found={settings.world.found} hideFound={settings.world.hideFound} tracked={tracked()} you={you()} follow across={settings.world.across} labels={false} />
      </Show>
    </section>
  );
}

/** What you track on this map, nearest first. */
export function TrackerOverlay() {
  const you = useYou();
  const { map } = useMap(() => you()?.map ?? 0);
  const rows = createMemo((): Near[] => {
    const m = map();
    const y = you();
    if (!m || !y?.known) return [];
    const things = m.things.filter((t) => settings.world.tracked.includes(keyOf(m.id, t)));
    return things.flatMap((t) => nearest(m, [t], settings.world.found, y, 1)).sort((a, b) => a.away - b.away).slice(0, 8);
  });
  return (
    <section class="tracker-list glass ui-num" aria-label="Tracker">
      <Show when={rows().length} fallback={<small class="ui-muted">Tracker: nothing tracked here</small>}>
        <For each={rows()}>
          {(n) => (
            <div class="tracker-line">
              <span class="dot" style={{ background: LAYER_COLOURS[n.thing.layer] }} />
              <span class="tracker-name">{n.thing.name}</span>
              <span>{far(n.away)}</span>
              <small class="ui-muted">{height(n.up)}</small>
            </div>
          )}
        </For>
      </Show>
    </section>
  );
}
