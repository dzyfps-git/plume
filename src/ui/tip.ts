// A short label beside an icon button while the pointer rests on it: the button's own aria-label, so what is read aloud
// and what is seen are the same words. Pages set no `title`: Windows draws those in its own style, late and off-screen.
import "./tip.css";

const WAIT = 350;
const WHAT = ".ui-icon-button[aria-label], .game-button[aria-label], [data-tip][aria-label]";

/** Shows labels for the whole page. Once per page. */
export function followTips() {
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("aria-hidden", "true");
  document.body.append(tip);
  let timer = 0;
  let on: Element | null = null;
  const hide = () => {
    clearTimeout(timer);
    on = null;
    tip.removeAttribute("data-shown");
  };
  document.addEventListener("pointerover", (e) => {
    const el = (e.target as Element | null)?.closest?.(WHAT) ?? null;
    if (el === on) return;
    hide();
    if (!el) return;
    on = el;
    timer = window.setTimeout(() => {
      if (!on?.isConnected) return;
      tip.textContent = on.getAttribute("aria-label");
      tip.setAttribute("data-shown", "");
      // Under the button, or above it with no room below; never past either side.
      const b = on.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      const below = b.bottom + 6 + t.height <= innerHeight;
      tip.style.top = `${below ? b.bottom + 6 : b.top - 6 - t.height}px`;
      tip.style.left = `${Math.min(innerWidth - t.width - 4, Math.max(4, b.left + b.width / 2 - t.width / 2))}px`;
    }, WAIT);
  });
  document.addEventListener("pointerdown", hide, true);
  document.addEventListener("pointerleave", hide);
  addEventListener("blur", hide);
}
