// The Checklist: every character as a column, and a row for each thing that is kept, used up or done.
import type { Kind, Resource } from "../../store/settings.ts";
import { full } from "../../ui/format.ts";
import { carried, energy, resetsBetween, type Kept } from "../characters/logic.ts";
import { power } from "../meter/logic.ts";
import { capOf, KIND_NAMES, kindOf, nameOf, wait } from "./logic.ts";

export const GROUPS = ["character", "energy", "entries", "keys", "corridors", "today", "week", "dungeons"] as const;
export type Group = (typeof GROUPS)[number];
export const GROUP_NAMES: Record<Group, string> = {
  character: "Character", energy: "Energy", entries: "Entries", keys: "Keys", corridors: "Abyss corridors", today: "Today", week: "This week", dungeons: "Dungeon rewards",
};

/** One character's part of a row. */
export interface Cell {
  n: number;
  /** As it is shown, when not the number. */
  text?: string;
  most?: number;
  /** On top of it, as the game says it second. */
  more?: string;
  note?: string;
  /** Full: what comes next is lost. */
  lost?: boolean;
  /** Nothing left to do this day or week. */
  done?: boolean;
}

export interface Row {
  key: string;
  group: Group;
  name: string;
  /** The game's picture, and a Segoe Fluent Icons character when there is none. */
  icon: string;
  glyph: string;
  /** Added up across characters. */
  sum: boolean;
  cells: (Cell | undefined)[];
  /** Done for every character that has it. */
  done: boolean;
}

/** Entries and keys by kind, in the order they show. */
const ENTRIES: Kind[] = ["nightmare", "fissure", "ascension", "transcendence", "conquest", "exploration", "subjugation", "forge", "rift"];
const KEYS: Kind[] = ["shugo", "invasion"];
const KIND_ICONS: Record<Kind, string> = {
  shugo: "Icon_Currency_Treasure_Key_Legend_004", invasion: "Icon_Currency_Treasure_Key_Legend_006", nightmare: "Icon_Ticket_Entrance_BossChallenge_001",
  ascension: "Icon_Ticket_Entrance_Awaken_001", transcendence: "Icon_Ticket_Entrance_PartyChallenge_001", conquest: "Icon_Ticket_Entrance_Dungeon_001",
  exploration: "Icon_Ticket_Entrance_Dungeon_001", fissure: "Icon_Ticket_Entrance_DailyDungeon_001", subjugation: "Icon_Add_Ticket_Dungeon_001",
  forge: "Icon_Ticket_Entrance_Raid_001", rift: "Icon_Item_Currency_AbyssTicekt_A_c_001",
};
/** The Abyss corridors the game counts, by its number. */
export const CORRIDORS: Record<number, string> = { 3: "Lower Abyss" };
/** Dungeon reward counters, by the game's numbers (Questlog's finding). Their names are not known. */
export const isReward = (id: number) => (id > 60_000_001 && id < 70_000_000) || (id >= 90_000_000 && id < 100_000_000);
/** Bought at the shop, by item, and made, by recipe (A2Tools' finding), with the week's most where guides say it. */
const SHOP: [id: number, name: string, icon: string][] = [
  [100_134, "Odyle Energy bought", "Icon_Item_Odenergy_A_001"],
  [100_135, "Rift Stones bought", "Icon_Item_Currency_AbyssTicekt_A_c_001"],
];
const CRAFTS: [id: number, name: string, most: number][] = [
  [32_070_002, "Odyle Energy crafted", 4],
  [32_070_001, "Odyle Energy crafted, server", 16],
];

interface Def {
  key: string;
  group: Group;
  name: string;
  icon?: string;
  glyph?: string;
  sum?: boolean;
  cell: (k: Kept) => Cell | undefined;
}

const count = (k: Kept, id: number) => k.counts.find(([at]) => at === id);
const plus = (n: number) => (n > 0 ? `+${full(n)}` : undefined);
const RESET = "Reset since last seen";
const DAILY_DUTIES = "";

/** The rows, with a cell for each character. A row no character has is left out. */
export function checklist(chars: readonly Kept[], chosen: readonly Resource[], member: boolean, now: number, mapName: (id: number) => string): Row[] {
  const ids = [...new Set(chars.flatMap((k) => k.counts.map(([id]) => id)))].sort((a, b) => a - b);
  const named = (id: number) => chosen.find((r) => r.id === id)?.name;
  // What was done counts only in the day or week it was seen in: after a reset it is to do again.
  const day = (k: Kept) => resetsBetween(k.at, now).day > 0;
  const week = (k: Kept) => resetsBetween(k.at, now).week > 0;
  // A row for each of the game's numbers of a kind: two numbers you gave one kind are two rows, each with its own name.
  const ofKind = (kind: Kind): Def[] => {
    const all = ids.filter((id) => kindOf(id, chosen) === kind);
    return (all.length ? all : [0]).map((at) => ({
      key: all.length > 1 ? `${kind}:${at}` : kind, group: KEYS.includes(kind) ? "keys" : "entries", name: (at && nameOf(at, chosen)) || KIND_NAMES[kind], icon: KIND_ICONS[kind], sum: true,
      cell: (k) => {
        const found = count(k, at);
        if (!found) return undefined;
        const most = capOf(kind, member);
        const n = carried(kind, found[1], k.at, now, member);
        return { n, most, more: plus(found[2]), lost: !!most && n >= most };
      },
    }));
  };
  const defs: Def[] = [
    { key: "kinah", group: "character", name: "Kinah today", icon: "Icon_Currency_Coin_GoldNonbinding", sum: true, cell: (k) => (k.kinah >= 0 ? { n: k.kinah } : undefined) },
    {
      key: "points", group: "character", name: "Abyss Points this week", icon: "Icon_abysspoint", sum: true,
      cell: (k) => {
        if (k.points[0] < 0) return undefined;
        const most = k.points[1] > 0 ? k.points[1] : undefined;
        if (week(k)) return { n: 0, most, note: RESET };
        return { n: k.points[0], most, done: !!most && k.points[0] >= most };
      },
    },
    { key: "place", group: "character", name: "Location", glyph: "", cell: (k) => (mapName(k.map) ? { n: 0, text: mapName(k.map) } : undefined) },
    { key: "power", group: "character", name: "Combat Power", icon: "profile_power_icon_pc", cell: (k) => (k.power ? { n: k.power, text: power(k.power) } : undefined) },
    { key: "level", group: "character", name: "Item level", glyph: "", cell: (k) => (k.level ? { n: k.level } : undefined) },
    {
      key: "odyle", group: "energy", name: "Odyle Energy", icon: "Icon_Item_Odenergy_A_001", sum: true,
      cell: (k) => {
        const e = energy(k, member, now);
        if (e.value < 0) return undefined;
        return { n: e.value, most: e.most, more: plus(k.odyle[1]), note: e.full ? `full in ${wait(e.full)}` : "Full", lost: !e.full };
      },
    },
    ...ENTRIES.flatMap(ofKind),
    ...KEYS.flatMap(ofKind),
    ...Object.entries(CORRIDORS).map(([id, name]): Def => ({
      key: `corridor:${id}`, group: "corridors", name, icon: "UT_Marker_AbyssPortal", sum: true,
      cell: (k) => { const c = count(k, Number(id)); return c && { n: c[1], more: plus(c[2]) }; },
    })),
    {
      key: "duty", group: "today", name: "Daily Duties", glyph: DAILY_DUTIES,
      cell: (k) => {
        if (k.duty[0] < 0) return undefined;
        if (day(k)) return { n: 0, most: k.duty[1], note: RESET };
        return { n: k.duty[0], most: k.duty[1], done: k.duty[1] > 0 && k.duty[0] >= k.duty[1] };
      },
    },
    ...SHOP.map(([id, name, icon]): Def => ({
      key: `shop:${id}`, group: "week", name, icon, cell: (k) => { const b = k.shop?.find(([at]) => at === id); return b && (week(k) ? { n: 0, note: RESET } : { n: b[1] }); },
    })),
    ...CRAFTS.map(([id, name, most]): Def => ({
      key: `craft:${id}`, group: "week", name, icon: "Icon_Item_Odenergy_A_001",
      cell: (k) => { const c = k.crafts?.find(([at]) => at === id); return c && (week(k) ? { n: 0, most, note: RESET } : { n: c[1], most, done: c[1] >= most }); },
    })),
    // What the game counts with no name known: dungeon rewards, then the rest, named by you or by number.
    ...ids.filter((id) => !kindOf(id, chosen) && !CORRIDORS[id]).map((id): Def => ({
      key: String(id), group: isReward(id) ? "dungeons" : "entries", name: named(id) || `${isReward(id) ? "Reward counter" : "Entry"} ${id}`,
      icon: isReward(id) ? "UT_Marker_Dungeon" : undefined, glyph: "", sum: true,
      cell: (k) => { const c = count(k, id); return c && { n: c[1], more: plus(c[2]) }; },
    })),
  ];
  return defs.flatMap((d) => {
    const cells = chars.map(d.cell);
    const had = cells.filter((c): c is Cell => !!c);
    if (!had.length) return [];
    return [{ key: d.key, group: d.group, name: d.name, icon: d.icon ?? "", glyph: d.glyph ?? "", sum: !!d.sum, cells, done: had.every((c) => c.done) }];
  });
}

/** What every character has together. */
export const total = (row: Row) => row.cells.reduce((all, c) => all + (c?.n ?? 0), 0);
