import { createSignal } from "solid-js";
import { onSkins } from "../../live/store";
import { heard, type Closet } from "./logic";

/** The skins in your Closet, as the game last said them. On this PC, yours alone. */
const KEY = "closet";
function read(): Closet {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Closet | null;
    return v && Array.isArray(v.ids) ? { ids: v.ids.filter((n) => Number.isInteger(n)), told: Number(v.told) || 0 } : { ids: [], told: 0 };
  } catch {
    return { ids: [], told: 0 };
  }
}
const [closet, setCloset] = createSignal<Closet>(read());
export { closet };
// The other window's.
addEventListener("storage", (e) => e.key === KEY && setCloset(read()));

/** Keeps what the game says of your Closet. */
export function followCloset() {
  onSkins((said) => {
    const next = heard(closet(), said, Date.now());
    if (next === closet()) return;
    setCloset(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  });
}
