import { createSignal, onCleanup } from "solid-js";
import { editOverlays } from "../api";
import { change, settings } from "../store";
import { drag } from "./zones";

/** Further than this, a press is a drag and not a click. In points. */
const STILL = 4;

/** A small button over the game that opens the overlay controls. It can be dragged anywhere. */
export function GameButton(props: { open: boolean }) {
  let button!: HTMLButtonElement;
  const [held, setHeld] = createSignal<{ x: number; y: number }>();
  // The window follows the game's, so its size is watched: the button stays on the screen when it shrinks.
  const [screen, setScreen] = createSignal({ width: innerWidth, height: innerHeight });
  const sized = () => setScreen({ width: innerWidth, height: innerHeight });
  addEventListener("resize", sized);
  onCleanup(() => removeEventListener("resize", sized));
  const at = () => {
    const { width, height } = screen();
    const x = settings.overlay.buttonAt.x * width, y = settings.overlay.buttonAt.y * height;
    return held() ?? { x: Math.max(0, Math.min(width - (button?.offsetWidth ?? 0), x)), y: Math.max(0, Math.min(height - (button?.offsetHeight ?? 0), y)) };
  };

  function grab(event: PointerEvent) {
    if (event.button !== 0) return;
    button.setPointerCapture(event.pointerId);
    const from = { x: event.clientX - at().x, y: event.clientY - at().y };
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    drag(true);
    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < STILL) return;
      moved = true;
      const x = Math.min(innerWidth - button.offsetWidth, Math.max(0, e.clientX - from.x));
      const y = Math.min(innerHeight - button.offsetHeight, Math.max(0, e.clientY - from.y));
      setHeld({ x, y });
    };
    const drop = () => {
      button.removeEventListener("pointermove", move);
      drag(false);
      const to = held();
      if (moved && to) change((s) => (s.overlay.buttonAt = { x: to.x / innerWidth, y: to.y / innerHeight }), true);
      else void editOverlays(props.open ? "" : "quick");
      setHeld(undefined);
    };
    button.addEventListener("pointermove", move);
    button.addEventListener("lostpointercapture", drop, { once: true });
  }

  return (
    <button
      ref={button}
      class="game-button"
      data-touch
      data-open={props.open || undefined}
      data-dim={settings.overlay.buttonDim || undefined}
      aria-label="Overlay controls"
      aria-pressed={props.open}
      style={{ transform: `translate(${Math.round(at().x)}px, ${Math.round(at().y)}px)` }}
      onPointerDown={grab}
    >
      <span class="ui-icon" aria-hidden="true">{"\ue9e9"}</span>
      {settings.hotkeys.quick ? <kbd>{settings.hotkeys.quick}</kbd> : undefined}
    </button>
  );
}
