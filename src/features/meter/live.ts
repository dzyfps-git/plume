// What the meter follows besides the fight itself: who bursts, who is dead, your last casts, and whether you look closer.
import { createEffect, createMemo, createRoot, createSignal, onCleanup, untrack } from "solid-js";
import { engineSend, on } from "../../api";
import { fight, near, onHappened, sampling, skills } from "../../live/store";
import { settings } from "../../store";
import { bursts } from "./logic";

const CASTS = 9;
/** A key that is held comes again this soon, the first time after Windows' longer wait. */
const FIRST = 1_100;
const AGAIN = 250;

const [bursting, setBursting] = createSignal<ReadonlySet<number>>(new Set());
const [fallen, setFallen] = createSignal<ReadonlyMap<number, number>>(new Map());
const [cast, setCasts] = createSignal<readonly { skill: number; name: string; at: number }[]>([]);
const [peek, setPeek] = createSignal(false);
/** To see the strip before there is a fight. */
const SAMPLE = ["Ambush", "Quick Slice", "Heart Gore", "Venom", "Quick Slice"].map((name, n) => ({ skill: -1 - n, name, at: n }));
const casts = () => (sampling() && !cast().length ? SAMPLE : cast());
/** Players far above their own average, when each of the party died, what you cast last, and whether the meter is opened to its details. */
export { bursting, casts, fallen, peek };

let following = false;
export function followMeter() {
  if (following) return;
  following = true;
  createRoot(() => {
    const look = bursts();
    createEffect(() => setBursting(settings.meter.burst ? look(fight) : new Set<number>()));

    createEffect(() => {
      const down = [...near.party, ...(near.you ? [near.you] : [])].filter((u) => u.hp === 0).map((u) => u.id);
      untrack(() => setFallen((was) => new Map(down.map((id) => [id, was.get(id) ?? Date.now()]))));
    });

    onHappened((h) => h.what === "cast" && !sampling() && setCasts((all) => [...all, { skill: h.skill, name: h.name, at: h.at }].slice(-CASTS)));

    // Your skills are worked out only while they are looked at. What another page watched is watched again after.
    const watched = createMemo(() => (peek() ? fight.rows.find((r) => r.you)?.id : undefined));
    createEffect(() => {
      const id = watched();
      if (id === undefined) return;
      const before = untrack(skills).id;
      void engineSend({ cmd: "watch", id }).catch(console.error);
      onCleanup(() => void engineSend({ cmd: "watch", id: before && before !== id ? before : null }).catch(console.error));
    });
  });

  let timer = 0;
  void on("peek", () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => setPeek(false), peek() ? AGAIN : FIRST);
    setPeek(true);
  });
}
