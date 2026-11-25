import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { overlayName, widthOf, type Feature } from "../features/types";
import { settings } from "../store";
import { place } from "../store/settings";
import { hold, snap, toPixels, toShare, type Spot } from "./layout";
import { move as movePlaces } from "./undo";
import { drag } from "./zones";

interface Props {
  feature: Feature;
  editing: boolean;
  /** The other overlays on screen, to line up with. */
  others: () => (Spot & { width: number; height: number })[];
}

/** Holds one overlay in its place. While editing it can be dragged, scaled and walked with the arrow keys. */
export function Frame(props: Props) {
  const overlay = props.feature.overlay!;
  let frame!: HTMLDivElement;
  /** As it is on the screen. */
  const [size, setSize] = createSignal({ width: widthOf(overlay), height: 80 });
  const [screen, setScreen] = createSignal({ width: innerWidth, height: innerHeight });
  const [held, setHeld] = createSignal<Spot>();

  const free = () => props.editing || !!overlay.loose?.();
  const zoom = () => at().scale * settings.overlay.size;
  const at = () => place(settings.places[props.feature.id], overlay.place);
  const spot = () => {
    const height = at().height;
    if (held()) return held()!;
    // While it is placed, it is as high as it is.
    if (!overlay.edge || !height || props.editing) return toPixels(at(), size(), screen());
    return hold(at(), size(), screen(), overlay.edge(), height * zoom());
  };
  // On a whole point of the screen: between two, everything in it would be soft.
  const whole = (v: number) => Math.round(v * devicePixelRatio) / devicePixelRatio;
  const put = (edit: Partial<ReturnType<typeof at>>) => {
    const next = { ...at(), ...edit, height: size().height / zoom() };
    movePlaces((all) => ({ ...all, [props.feature.id]: next }));
  };
  const putAt = (to: Spot) => put(toShare(to, size(), screen()));

  onMount(() => {
    const watch = new ResizeObserver(() => {
      const { width, height } = frame.getBoundingClientRect();
      setSize({ width, height });
    });
    watch.observe(frame);
    const resized = () => setScreen({ width: innerWidth, height: innerHeight });
    addEventListener("resize", resized);
    onCleanup(() => {
      watch.disconnect();
      removeEventListener("resize", resized);
    });
  });
  // Leaving edit mode in the middle of a drag keeps where it was dragged to.
  createEffect(() => {
    const to = held();
    if (!free() && to) {
      putAt(to);
      setHeld(undefined);
    }
  });

  function grab(event: PointerEvent) {
    if (!free() || at().locked || event.button !== 0 || (event.target as Element).closest("button")) return;
    frame.setPointerCapture(event.pointerId);
    const begun = spot();
    const from = { x: event.clientX - spot().x, y: event.clientY - spot().y };
    setHeld(spot());
    if (!props.editing) drag(true);
    const others = props.others().filter((o) => o.x !== spot().x || o.y !== spot().y);
    const move = (e: PointerEvent) => {
      const loose = { x: e.clientX - from.x, y: e.clientY - from.y };
      // Alt drags without the grid.
      setHeld(e.altKey || !settings.overlay.snap ? loose : snap(loose, size(), screen(), others));
    };
    const drop = () => {
      frame.removeEventListener("pointermove", move);
      const to = held();
      // A click is no move.
      if (to && (to.x !== begun.x || to.y !== begun.y)) putAt(to);
      setHeld(undefined);
      drag(false);
    };
    frame.addEventListener("pointermove", move);
    frame.addEventListener("lostpointercapture", drop, { once: true });
  }

  function walk(event: KeyboardEvent) {
    const [x, y] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key] ?? [0, 0];
    if (!props.editing || at().locked || (!x && !y)) return;
    event.preventDefault();
    const by = event.shiftKey ? 10 : 1;
    putAt({ x: spot().x + x * by, y: spot().y + y * by });
  }

  const scale = (by: number) => put({ scale: Math.round(Math.min(2, Math.max(0.6, at().scale + by)) * 20) / 20 });

  return (
    <div
      ref={frame}
      class="frame"
      data-editing={props.editing || undefined}
      data-frame={props.feature.id}
      tabIndex={props.editing ? 0 : undefined}
      data-locked={at().locked || undefined}
      aria-label={overlayName(props.feature)}
      style={{ transform: `translate(${whole(spot().x)}px, ${whole(spot().y)}px)` }}
      onPointerDown={grab}
      onKeyDown={walk}
      onWheel={(e) => props.editing && scale(e.deltaY < 0 ? 0.05 : -0.05)}
    >
      <div class="frame-body" style={{ width: `${widthOf(overlay)}px`, zoom: zoom(), "--px": `${1 / (zoom() * devicePixelRatio)}px` }}>
        <overlay.view />
      </div>
      <Show when={props.editing}>
        <div class="frame-bar">
          <span>{overlayName(props.feature)}</span>
          <button class="ui-icon-button" aria-label={at().locked ? "Unlock" : "Lock"} aria-pressed={!!at().locked} onClick={() => put({ locked: !at().locked })}>{at().locked ? "\ue72e" : "\ue785"}</button>
          <button class="ui-icon-button" aria-label="Smaller" onClick={() => scale(-0.05)}>{""}</button>
          <small class="ui-num">{Math.round(at().scale * 100)}%</small>
          <button class="ui-icon-button" aria-label="Bigger" onClick={() => scale(0.05)}>{""}</button>
          <button class="ui-icon-button" aria-label="Hide" onClick={() => put({ on: false })}>{""}</button>
        </div>
      </Show>
    </div>
  );
}
