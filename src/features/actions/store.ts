import { createMemo, createResource, createRoot, createSignal } from "solid-js";
import { fight as loadFight, on } from "../../api";
import { near, onHappened } from "../../live/store";
import type { Saved } from "../../live/types";
import { fights, followFights } from "../history/store";
import { learned, type Known } from "./logic";

/** Fights it learns from, the newest. */
const READ = 15;

const [casts, setCasts] = createSignal<ReadonlyMap<number, number>>(new Map());
let known: () => Known[] = () => [];
let read: () => Saved[] = () => [];

/** When each of your skills was last used. */
export { casts };
/** Your skills with a cooldown. */
export const skills = () => known();
/** Your newest fights, whole. */
export const recent = () => read();

let following = false;
/** Learns from your fights, and watches your casts. */
export function followActions() {
  if (following) return;
  following = true;
  followFights();
  onHappened((h) => h.what === "cast" && setCasts((all) => new Map(all).set(h.skill, h.at)));
  createRoot(() => {
    const kept = new Map<string, Saved>();
    // A fight is said again as it grows.
    void on("saved", ({ id }) => kept.delete(id));
    const newest = createMemo(() => fights().filter((f) => f.you).slice(0, READ));
    const [whole] = createResource(newest, async (list) => {
      for (const { id } of list) {
        if (kept.has(id)) continue;
        const f = await loadFight(id);
        if (f) kept.set(id, f);
      }
      for (const id of kept.keys()) if (!list.some((f) => f.id === id)) kept.delete(id);
      return [...kept.values()].sort((a, b) => b.start - a.start);
    });
    read = () => whole.latest ?? [];
    known = createMemo(() => learned(read(), near.you?.job ?? ""));
  });
}
