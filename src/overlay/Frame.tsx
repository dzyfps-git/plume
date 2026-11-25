import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { overlayName, type Feature } from "../features/types";
import { change, settings } from "../store";
import { place } from "../store/settings";
import { hold, snap, toPixels, toShare, type Spot } from "./layout";

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
  const [size, setSize] = createSignal({ width: overlay.width, height: 80 });
  const [screen, setScreen] = createSignal({ width: innerWidth, height: innerHeight });
  const [held, setHeld] = createSignal<Spot>();

  const at = () => place(settings.places[props.feature.id], overlay.place);
  const scaled = () => ({ width: size().width * at().scale, height: size().height * at().scale });
  const spot = () => {
    const height = at().height;
    if (held()) return held()!;
    // While it is placed, it is as high as it is.
    if (!overlay.edge || !height || props.editing) return toPixels(at(), scaled(), screen());
    return hold(at(), scaled(), screen(), overlay.edge(), height * at().scale);
  };
  const put = (edit: Partial<ReturnType<typeof at>>) => {
    const next = { ...at(), ...edit, height: size().height };
    change((s) => (s.places = { ...s.places, [props.feature.id]: next }), true);
  };
  const putAt = (to: Spot) => put(toShare(to, scaled(), screen()));

  onMount(() => {
    const watch = new ResizeObserver(() => setSize({ width: frame.offsetWidth, height: frame.offsetHeight }));
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
    if (!props.editing && to) {
      putAt(to);
      setHeld(undefined);
    }
  });

  function grab(event: PointerEvent) {
    if (!props.editing || at().locked || event.button !== 0 || (event.target as Element).closest("button")) return;
    frame.setPointerCapture(event.pointerId);
    const from = { x: event.clientX - spot().x, y: event.clientY - spot().y };
    setHeld(spot());
    const others = props.others().filter((o) => o.x !== spot().x || o.y !== spot().y);
    const move = (e: PointerEvent) => {
      const free = { x: e.clientX - from.x, y: e.clientY - from.y };
      // Alt drags without the grid.
      setHeld(e.altKey ? free : snap(free, scaled(), screen(), others));
    };
    const drop = () => {
      frame.removeEventListener("pointermove", move);
      const to = held();
      if (to) putAt(to);
      setHeld(undefined);
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
      style={{ width: `${overlay.width}px`, transform: `translate(${spot().x}px, ${spot().y}px) scale(${at().scale})` }}
      onPointerDown={grab}
      onKeyDown={walk}
      onWheel={(e) => props.editing && scale(e.deltaY < 0 ? 0.05 : -0.05)}
    >
      <overlay.view />
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
