// What you gained, gathered and saw drop, by day from one daily reset to the next, and Dice Rolls.
import type { LootEvent, RollEvent } from "../../live/types.ts";

/** Item names, grades and pictures, as the engine's `tools/items.py` writes them. */
export interface ItemFile {
  grades: string[];
  items: Record<string, [name: string, grade: number, icon: string]>;
}

export const itemName = (file: ItemFile | null | undefined, id: number) => file?.items[id]?.[0] || `Item ${id}`;
/** The grade's name, lower case, for its colour. Empty when not known. */
export const gradeOf = (file: ItemFile | null | undefined, id: number) => (file?.items[id] ? file.grades[file.items[id][1]]?.toLowerCase() ?? "" : "");

/** One day's loot. Counts by item number, and by monster code for kills. */
export interface Day {
  /** The daily reset it began at. */
  start: number;
  /** Time with loot or kills no more than a few minutes apart. */
  active: number;
  last: number;
  gained: Record<string, number>;
  gathered: Record<string, number>;
  /** Your own drops, by monster and item. */
  dropped: Record<string, Record<string, number>>;
  /** Monsters you hit that died. */
  kills: Record<string, number>;
  /** Kinah today as the game said it first and last this day. -1 when not said. */
  kinah: [first: number, last: number];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Days begin at 07:00 UTC, as `resets` has it. */
export const dayOf = (at: number) => Math.floor((at - 7 * HOUR) / DAY) * DAY + 7 * HOUR;
/** A gap longer than this is time away. */
const AWAY = 5 * 60_000;

export const emptyDay = (start: number): Day => ({ start, active: 0, last: 0, gained: {}, gathered: {}, dropped: {}, kills: {}, kinah: [-1, -1] });

const add = (to: Record<string, number>, key: number, n: number) => (n > 0 ? { ...to, [key]: (to[key] ?? 0) + n } : to);

/** What an item entry gained: a new item's stack, a stack's growth. Use and loss are not loot. */
const grew = (i: { change: string; total: number; gained: number | null }) => (i.gained ?? (i.change === "new" ? i.total : 0));

/** The day with one more event. Events of another day are not its. */
export function count(day: Day, e: LootEvent): Day {
  if (dayOf(e.at) !== day.start) return day;
  const d = { ...day, active: day.active + (day.last && e.at - day.last < AWAY ? Math.max(0, e.at - day.last) : 0), last: Math.max(day.last, e.at) };
  if (e.kind === "items") for (const i of e.items) d.gained = add(d.gained, i.item, grew(i));
  else if (e.kind === "gather" && e.gather.type === "done") {
    d.gathered = add(d.gathered, e.gather.item, e.gather.count + e.gather.bonus);
    d.gathered = add(d.gathered, e.gather.extraItem, e.gather.extraCount);
  } else if (e.kind === "drops") {
    for (const x of e.drops) {
      if (x.owner !== "you" || !x.mob) continue;
      d.dropped = { ...d.dropped, [x.mob]: add(d.dropped[x.mob] ?? {}, x.item, x.count) };
    }
  } else if (e.kind === "kill" && e.byYou) d.kills = add(d.kills, e.mob, 1);
  return d;
}

/** Kinah today, as the game says it. */
export const kinahSaid = (day: Day, kinah: number): Day =>
  kinah < 0 || kinah === day.kinah[1] ? day : { ...day, kinah: [day.kinah[0] < 0 ? kinah : day.kinah[0], kinah] };

/** Kinah gained this day: what Kinah today grew by while Plume saw it. */
export const kinahGained = (day: Day) => (day.kinah[0] < 0 ? 0 : Math.max(0, day.kinah[1] - day.kinah[0]));

/** An hour of active time, at least a minute of it. */
export const anHour = (n: number, active: number) => (active < 60_000 ? 0 : (n * HOUR) / active);

export interface Rate {
  mob: number;
  item: number;
  drops: number;
  kills: number;
}

/** Your drop rate of each item from each monster, over the days given: your drops against your kills. */
export function rates(days: readonly Day[]): Rate[] {
  const kills: Record<string, number> = {};
  const drops: Record<string, Record<string, number>> = {};
  for (const d of days) {
    for (const [mob, n] of Object.entries(d.kills)) kills[mob] = (kills[mob] ?? 0) + n;
    for (const [mob, items] of Object.entries(d.dropped)) for (const [item, n] of Object.entries(items)) (drops[mob] ??= {})[item] = (drops[mob][item] ?? 0) + n;
  }
  return Object.entries(drops)
    .flatMap(([mob, items]) => Object.entries(items).map(([item, n]) => ({ mob: Number(mob), item: Number(item), drops: n, kills: kills[mob] ?? 0 })))
    .filter((r) => r.kills > 0)
    .sort((a, b) => b.kills - a.kills || b.drops - a.drops);
}

/** One Dice Roll, put together from what the game said of it. */
export interface Roll {
  /** The roll's id, or the item's when the id was not said yet. */
  id: string;
  item: number;
  count: number;
  at: number;
  ends: number;
  /** Highest first. Yours has no name. */
  rolls: { name: string; roll: number; you: boolean }[];
  passed: string[];
  winner: string;
}

const MOST_ROLLS = 100;

/** The rolls with one more thing said. Another's roll names the item and not the roll: it goes to the newest roll of it. */
export function rolled(all: readonly Roll[], e: RollEvent): Roll[] {
  const r = e.roll;
  const item = r.type === "mine" ? 0 : r.itemId;
  const at = all.findIndex((x) => ("rollId" in r && x.id === r.rollId) || (r.type === "roll" && x.item === r.itemId && !x.winner));
  const was: Roll = at >= 0 ? all[at] : { id: "rollId" in r ? r.rollId : `item ${item}`, item, count: 1, at: e.at, ends: 0, rolls: [], passed: [], winner: "" };
  const next: Roll = { ...was, item: was.item || item };
  if (r.type === "open") Object.assign(next, { count: r.count, ends: r.endsAt });
  else if (r.type === "mine") next.rolls = [...was.rolls.filter((x) => !x.you), { name: "", roll: r.roll, you: true }];
  else if (r.type === "roll") next.rolls = [...was.rolls.filter((x) => x.you || x.name !== r.player.name), { name: r.player.name, roll: r.roll, you: false }];
  else if (r.type === "pass") next.passed = [...new Set([...was.passed, r.player.name])];
  else next.winner = r.player.name;
  next.rolls = [...next.rolls].sort((a, b) => b.roll - a.roll);
  return (at >= 0 ? all.map((x, i) => (i === at ? next : x)) : [next, ...all]).slice(0, MOST_ROLLS);
}
