// What of the overlay takes the mouse while you play. Everything else lets clicks through to the game.
import { setZones } from "../api";

let last = "";
let dragging = false;

function tell() {
  const all = [...document.querySelectorAll<HTMLElement>("[data-touch]")].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  const whole = new DOMRect(0, 0, innerWidth, innerHeight);
  const zones = (dragging ? [whole] : all).map((r) => [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v * devicePixelRatio)) as [number, number, number, number]);
  const text = JSON.stringify(zones);
  if (text === last) return;
  last = text;
  void setZones(zones).catch(console.error);
}

/** While something is dragged the pointer may leave it. */
export function drag(on: boolean) {
  dragging = on;
  tell();
}

export function followZones() {
  tell();
  setInterval(tell, 300);
}
