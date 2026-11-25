/* @ds-bundle: {"format":4,"namespace":"House","components":[]} */
(() => {
  // Plain script, no framework: works the same beside React, Solid, Svelte or none.
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const still = () => reduced.matches || root.dataset.mood === "calm";
  const style = (el, name, fallback) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

  /** Plays a change as a View Transition. `kind` lands on the root as data-morph while it plays. */
  function morph(change, kind = "change") {
    if (still() || !document.startViewTransition) return change();
    root.dataset.morph = kind;
    const transition = document.startViewTransition(change);
    // A change that starts while this one plays skips it, which is no fault.
    transition.ready.catch(() => undefined);
    transition.finished.finally(() => root.dataset.morph === kind && delete root.dataset.morph);
    return transition;
  }

  let following = false;
  dark.addEventListener("change", () => following && (root.dataset.theme = dark.matches ? "dark" : "light"));

  /** "light", "dark" or "auto". From a control, the new theme spreads out in a circle from it. */
  function theme(name, from) {
    following = name === "auto";
    const next = following ? (dark.matches ? "dark" : "light") : name;
    if (next === root.dataset.theme) return;
    const set = () => (root.dataset.theme = next);
    if (!from) return set();
    const { left, top, width, height } = from.getBoundingClientRect();
    root.style.setProperty("--reveal-x", `${left + width / 2}px`);
    root.style.setProperty("--reveal-y", `${top + height / 2}px`);
    morph(set, "theme");
  }

  // Where the user asked, so a sheet can grow out of it.
  let asked;
  addEventListener("pointerdown", (event) => (asked = { x: event.clientX, y: event.clientY }), true);
  addEventListener("keydown", () => {
    const el = document.activeElement;
    if (!el || el === document.body) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    if (width || height) asked = { x: left + width / 2, y: top + height / 2 };
  }, true);

  /** Opens a <dialog class="ui-sheet"> out of where the user asked for it. Answers with its close. */
  function openSheet(dialog) {
    dialog.showModal();
    const box = dialog.getBoundingClientRect();
    const from = asked ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const small = Number(style(dialog, "--sheet-from", "0.35"));
    const calm = small > 0.9;
    dialog.style.transformOrigin = calm ? "center" : `${from.x - box.left}px ${from.y - box.top}px`;
    if (!reduced.matches) {
      dialog.animate({ scale: [small, 1], opacity: [0, 1] }, { duration: calm ? 150 : 420, easing: style(dialog, "--spring", "ease-out") });
    }
    let closing = false;
    function close(after) {
      if (closing || !dialog.open) return;
      closing = true;
      let leaving;
      const finish = () => {
        dialog.removeEventListener("cancel", cancel);
        dialog.close();
        leaving?.cancel();
        after?.();
      };
      if (reduced.matches) return finish();
      leaving = dialog.animate({ scale: [1, small], opacity: [1, 0] }, { duration: calm ? 100 : 170, easing: "ease-in", fill: "forwards" });
      leaving.finished.then(finish, () => undefined);
    }
    function cancel(event) {
      event.preventDefault();
      close();
    }
    dialog.addEventListener("cancel", cancel);
    return close;
  }

  /** Shows a popover menu at its button, turned up where there is no room below. Arrow keys walk it. */
  function openMenu(menu, button) {
    menu.showPopover();
    const at = button.getBoundingClientRect();
    // Offset sizes, because the entrance scales the box while it is measured.
    const { offsetWidth: width, offsetHeight: height } = menu;
    const below = at.bottom + 4 + height <= innerHeight;
    menu.style.left = `${Math.max(4, Math.min(at.left, innerWidth - width - 4))}px`;
    menu.style.top = `${Math.max(4, below ? at.bottom + 4 : at.top - 4 - height)}px`;
    menu.style.transformOrigin = below ? "top left" : "bottom left";
    const items = () => [...menu.querySelectorAll(".ui-menu-item:enabled")];
    items()[0]?.focus({ preventScroll: true });
    menu.onkeydown = (event) => {
      const by = { ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (!by) return;
      event.preventDefault();
      const all = items();
      all.at((all.indexOf(document.activeElement) + by) % all.length)?.focus();
    };
  }

  /** Slides the one highlight of a list to a row of it, or hides it. */
  function glideTo(marker, row) {
    marker.style.opacity = row ? 1 : 0;
    if (!row) return;
    marker.style.left = `${row.offsetLeft}px`;
    marker.style.width = `${row.offsetWidth}px`;
    marker.style.height = `${row.offsetHeight}px`;
    marker.style.transform = `translateY(${row.offsetTop}px)`;
  }

  /** Sets a .ui-meter from 0 to 1. A gain rises like a tide, except in the calm mood. */
  function meter(bar, value) {
    const fill = bar.firstElementChild;
    const before = Number(fill.style.getPropertyValue("--value") || 0);
    const next = Math.max(0, Math.min(1, value));
    fill.style.setProperty("--value", next);
    bar.setAttribute("aria-valuenow", Math.round(next * 100));
    if (next <= before || reduced.matches) return;
    const tide = document.createElement("span");
    tide.className = "ui-tide";
    tide.style.setProperty("--from", before);
    tide.style.setProperty("--to", next);
    bar.append(tide);
    setTimeout(() => tide.remove(), 1500);
  }

  /** The accent draws round an element's edge once. Signature mood only. */
  function edge(el = document.body) {
    if (reduced.matches || el.closest("[data-mood]")?.dataset.mood !== "signature") return;
    const line = document.createElement("span");
    line.className = "ui-edge";
    if (el === document.body) line.style.position = "fixed";
    el.append(line);
    setTimeout(() => line.remove(), 1900);
  }

  /** Slides a job card out and takes it away. */
  function leave(el) {
    if (reduced.matches) return el.remove();
    el.dataset.leaving = "";
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  // Hover text: any button with an aria-label, or anything with data-tip. Never a title attribute.
  const LABELLED = "button[aria-label], input[aria-label][type=range], [data-tip]";
  function tooltips() {
    const box = document.createElement("div");
    box.className = "ui-tip";
    box.popover = "manual";
    box.setAttribute("aria-hidden", "true");
    document.body.append(box);
    let timer;
    let current;
    let warmUntil = 0;
    const isOpen = () => box.matches(":popover-open");
    function hide() {
      clearTimeout(timer);
      if (isOpen()) warmUntil = performance.now() + 900;
      current = undefined;
      box.togglePopover(false);
    }
    function place() {
      if (!current?.isConnected) return hide();
      box.toggleAttribute("data-glide", isOpen());
      box.textContent = current.dataset.tip || current.getAttribute("aria-label");
      const keys = current.getAttribute("aria-keyshortcuts");
      if (keys) {
        const hint = document.createElement("span");
        hint.className = "ui-keys";
        for (const key of keys.replace("Control", "Ctrl").split("+")) {
          const pill = document.createElement("kbd");
          pill.textContent = key;
          hint.append(pill);
        }
        box.append(hint);
      }
      box.togglePopover(true);
      const at = current.getBoundingClientRect();
      const { offsetWidth: width, offsetHeight: height } = box;
      box.style.left = `${Math.max(4, Math.min(at.left + (at.width - width) / 2, innerWidth - width - 4))}px`;
      box.style.top = `${at.bottom + 10 + height <= innerHeight ? at.bottom + 6 : at.top - 6 - height}px`;
    }
    addEventListener("pointerover", (event) => {
      if (event.buttons) return;
      const next = event.target.closest?.(LABELLED) ?? undefined;
      if (next === current) return;
      if (!next) return hide();
      clearTimeout(timer);
      current = next;
      // Right after one closes, the next opens almost at once: the user is reading along a row.
      if (isOpen()) place();
      else timer = setTimeout(place, performance.now() < warmUntil ? 60 : 450);
    });
    addEventListener("focusin", (event) => {
      const next = event.target.closest?.(LABELLED);
      if (!next?.matches(":focus-visible")) return;
      current = next;
      place();
    });
    addEventListener("focusout", hide);
    addEventListener("pointerdown", hide);
    addEventListener("blur", hide);
    addEventListener("keydown", (event) => event.key === "Escape" && hide());
    root.addEventListener("pointerleave", hide);
  }

  function fill(slider) {
    const least = Number(slider.min || 0);
    const most = Number(slider.max || 100);
    slider.style.setProperty("--fill", (slider.value - least) / (most - least));
  }

  let started = false;
  /** Call once the page is there: hover text, slider fill, number steps, resting loops. */
  function start() {
    if (started) return;
    started = true;
    tooltips();
    document.querySelectorAll(".ui-slider").forEach(fill);
    addEventListener("input", (event) => event.target.matches?.(".ui-slider") && fill(event.target));
    addEventListener("click", (event) => {
      const step = event.target.closest?.(".ui-number [data-step]");
      if (!step) return;
      const input = step.closest(".ui-number").querySelector("input");
      if (Number(step.dataset.step) > 0) input.stepUp();
      else input.stepDown();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    addEventListener("blur", () => root.setAttribute("data-blurred", ""));
    addEventListener("focus", () => root.removeAttribute("data-blurred"));
  }

  window.House = { start, theme, morph, openSheet, openMenu, glideTo, meter, edge, leave };
})();
