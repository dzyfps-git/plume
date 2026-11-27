import type { Aura, Near, Unit } from "../../live/types.ts";
import type { Named, Settings } from "../../store/settings.ts";

/** What keeps you from acting, in words. */
export const CONTROL: Record<string, string> = {
  stumble: "Stumbling", root: "Rooted", bind: "Bound", blind: "Blinded", silence: "Silenced", hold: "Held", air: "In the air",
  down: "Knocked down", charm: "Charmed", fear: "Afraid", sleep: "Asleep", frozen: "Frozen", stone: "Turned to stone", stun: "Stunned",
};

export const called = (a: Pick<Aura, "id" | "name">) => a.name || `Effect ${a.id}`;

/** One or two letters to know an effect by. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "").slice(0, 2);
  return letters.charAt(0).toUpperCase() + letters.slice(1);
}

/** A hue that is always the same for one name. */
export const hue = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** What is left of it in ms. Nothing when it has no end. */
export const left = (a: { end: number }, now: number) => (a.end ? Math.max(0, a.end - now) : undefined);

/** 1:05, 42, 4.2 */
export function remaining(ms: number): string {
  if (ms >= 60_000) return `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  return ms < 5_000 ? (ms / 1000).toFixed(1) : String(Math.ceil(ms / 1000));
}

/** Yours are told with you alone, not in the party's row of you. */
export const effects = (unit: Unit, near: Pick<Near, "you">) => (unit.you && near.you ? near.you.auras : unit.auras);

const soonest = (a: Aura, b: Aura) => (a.end || 1e15) - (b.end || 1e15) || a.id - b.id;

/** Good ones that run out. A passive is always on, so it says nothing. */
export const buffs = (auras: readonly Aura[]) => auras.filter((a) => !a.bad && (a.end > 0 || a.item)).sort(soonest);
export const debuffs = (auras: readonly Aura[]) => auras.filter((a) => a.bad).sort(soonest);

/** What holds you longest of what keeps you from acting. */
export const held = (auras: readonly Aura[]): Aura | undefined => auras.filter((a) => a.tag in CONTROL).sort((a, b) => soonest(b, a))[0];

/** The same, of the kinds you want to see, and not the short ones. */
export const heldFor = (auras: readonly Aura[], set: Pick<Settings["control"], "skip" | "least">) =>
  held(auras.filter((a) => !set.skip.includes(a.tag) && (!a.end || a.end - a.start >= set.least * 1000)));

/** Buffs you want to see, those of items in a list of their own when they stand apart. */
export function chosenBuffs(auras: readonly Aura[], set: Pick<Settings["buffs"], "items" | "skip">): { main: Aura[]; items: Aura[] } {
  const all = buffs(auras).filter((a) => !set.skip.some((s) => same(s, a)));
  if (set.items === "with") return { main: all, items: [] };
  return { main: all.filter((a) => !a.item), items: set.items === "apart" ? all.filter((a) => a.item) : [] };
}

/** The same effect, or another rank of it. */
export const same = (of: Named, a: Pick<Aura, "id" | "name">) => of.id === a.id || (!!of.name && of.name === a.name);

/** Stands for food, a scroll, or anything else of an item. */
export const ANY_ITEM: Named = { id: 0, name: "" };
const isAny = (n: Named) => n.id === 0 && !n.name;
export const chosenName = (n: Named) => (isAny(n) ? "Food, scroll or other item" : called(n));

/** Chosen effects that are not on you, out of fights. */
export function missing(ready: readonly Named[], near: Pick<Near, "you" | "fighting">): Named[] {
  if (!near.you || near.fighting) return [];
  const on = near.you.auras;
  return ready.filter((r) => !on.some((a) => (isAny(r) ? a.item : same(r, a))));
}
