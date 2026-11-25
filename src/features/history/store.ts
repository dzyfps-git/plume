import { createSignal } from "solid-js";
import { fights as load, on } from "../../api";
import type { Saved } from "../../live/types";

const [fights, setFights] = createSignal<Saved[]>([]);
export { fights };

const refresh = async () => setFights(await load());

let following = false;
/** Reads the fights the first time a page asks, then after each new one. */
export function followFights() {
  if (following) return;
  following = true;
  void refresh().catch(console.error);
  void on("saved", () => void refresh().catch(console.error));
}

export const forgetFight = (id: string) => setFights((all) => all.filter((f) => f.id !== id));
