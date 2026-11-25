// What the engine says. Features know only this, so the engine can be replaced.

export type Job =
  | "gladiator" | "templar" | "ranger" | "assassin" | "sorcerer"
  | "cleric" | "spiritmaster" | "chanter" | "fighter" | "";

export interface State {
  version: string;
  /** The game is connected and talking. */
  live: boolean;
  /** Started after you entered the world, so some names are unknown until a zone change. */
  late: boolean;
  devices: number;
}

/** How much was read of each kind since the engine began. */
export interface Reads {
  hits: number;
  taken: number;
  health: number;
  buffs: number;
  stats: number;
  targetHealth: boolean;
  stagger: boolean;
  you: boolean;
  zone: boolean;
  skills: number;
  unnamed: number;
}

export interface Target {
  name: string;
  code: number;
  /** -1 when unknown. */
  hp: number;
  /** 0 when unknown. */
  maxHp: number;
  boss: boolean;
  /** How far the stagger gauge is worn down, 0 to 100. -1 when there is none. */
  stagger: number;
  /** A training dummy. */
  dummy: boolean;
}

export interface Row {
  id: number;
  /** Empty when not known yet. */
  name: string;
  job: Job;
  damage: number;
  dps: number;
  /** 0 to 100. */
  share: number;
  you: boolean;
  deaths: number;
  taken: number;
  hps: number;
  power: number;
  /** Item level, of you and of those in your party. 0 when not known. */
  level: number;
  healing: number;
  hits: number;
  /** Damage this player's buffs added to others', and others' to theirs. 0 unless the meter shows it. */
  given: number;
  got: number;
  /** Not a player: an estimate of everyone who cannot be seen. */
  others: boolean;
}

export interface Fight {
  mode: string;
  target: Target;
  targets: number[];
  ms: number;
  total: number;
  /** The training time limit has run out. */
  timeup: boolean;
  dungeon: number;
  /** Your direct hits on it: how many, criticals, from behind. */
  own: [hits: number, crits: number, backs: number];
  rows: Row[];
}

export interface Skill {
  code: number;
  name: string;
  dot: boolean;
  hits: number;
  damage: number;
  crits: number;
  backs: number;
  perfects: number;
  doubles: number;
  /** Hits that came with extra hits, how many extra, and their damage. Not in fights of older versions, like what follows. */
  multis?: number;
  extras?: number;
  bonus?: number;
  parries?: number;
  blocks?: number;
  fronts?: number;
  min: number;
  max: number;
  /** Of a heal: how much of it could be weighed, and how much of that was too much. Missing when nothing. */
  weighed?: number;
  over?: number;
}

export interface FightRow {
  id: number;
  name: string;
  job: Job;
  damage: number;
  dps: number;
  share: number;
  you: boolean;
  deaths: number;
  taken: number;
  hitsTaken?: number;
  /** Hits met with a block or a parry. */
  blocked?: number;
  /** Combat Power. 0 when not known. */
  power?: number;
  healing?: number;
  given?: number;
  got?: number;
  stagger?: number;
  curve?: number[];
  skills: Skill[];
  heals?: Skill[];
  /** Your biggest direct hit with each skill. Only in the list, which is without the skills themselves. */
  big?: [skill: number, name: string, most: number][];
}

/** ms, skill, damage, and one more: for your hits what they were, for hits taken the health left or -1. */
export type Entry = readonly [ms: number, skill: number, damage: number, more: number];

/** What a hit was, as bits of its fourth number. */
export const FLAG = { crit: 1, back: 2, perfect: 4, double: 8, frontal: 16, block: 32, parry: 64, wall: 128, dot: 256 } as const;

export interface Death {
  id: number;
  you: boolean;
  ms: number;
  /** -1 when not up again. */
  up: number;
  hits: Entry[];
}

export interface StaggerWindow {
  start: number;
  end: number;
  broke: boolean;
  max: number;
  /** Taken off the gauge, by player. In a fight from before, everyone else is 0. */
  by: Record<string, number>;
}

export interface Buff {
  id: number;
  name: string;
  /** A player, or the target. */
  on: number;
  /** In a fight from before, 0 is someone else. */
  by: number;
  skill: number;
  passive: boolean;
  up: number;
  spans: [start: number, end: number, stacks: number][];
}

export interface Credit {
  by: number;
  to: number;
  id: number;
  name: string;
  damage: number;
}

/** A finished fight. The list gives it without its long lists. Those are also missing from fights of older versions. */
export interface Saved {
  id: string;
  target: string;
  code: number;
  start: number;
  ms: number;
  total: number;
  maxHp: number;
  killed: boolean;
  dummy: boolean;
  dungeon: number;
  /** When the dungeon run began that this is part of. 0 outside one. */
  run?: number;
  /** Health a world boss lost, more than was seen. 0 when not known. */
  lost?: number;
  /** The target's health at the end, -1 when not known. Only in the list. */
  left?: number;
  you: FightRow | null;
  /** Everyone else's damage, as one sum. */
  others: number;
  players: number;

  /** Your own total after each second. */
  curve?: number[];
  /** The target's health after each second, -1 when not known. */
  health?: number[];
  casts?: Entry[];
  taken?: Entry[];
  /** Monsters' skills on anyone: ms, skill, players hit, damage. */
  blows?: Entry[];
  names?: Record<string, string>;
  /** Yours alone in a fight from before. */
  deaths?: Death[];
  stagger?: StaggerWindow[];
  buffs?: Buff[];
  stats?: Record<string, number>;
  /** Round trips: ms, how long. */
  pings?: [ms: number, ping: number][];
  /** Only for a fight of this session. Never written to disk. */
  rows?: FightRow[];
  credits?: Credit[];
}

/** A buff or debuff that is on. */
export interface Aura {
  key: string;
  id: number;
  /** Empty when not known. */
  name: string;
  skill: number;
  /** Bad for whoever has it. */
  bad: boolean;
  /** What it does, when that is known: "stun", "safe" and so on. Else empty. */
  tag: string;
  /** From food, a scroll or another item. */
  item: boolean;
  by: number;
  yours: boolean;
  /** Another player outside your party put it on. */
  foe: boolean;
  stacks: number;
  /** By this PC's clock, in ms. The end is 0 when there is none. */
  start: number;
  end: number;
}

export interface Unit {
  key: string;
  id: number;
  name: string;
  job: Job;
  you: boolean;
  boss: boolean;
  /** -1 when not known. */
  hp: number;
  /** The most that was said or seen. 0 when not known. */
  maxHp: number;
  /** Combat Power and item level, of you and your party alone. 0 when not known. */
  power: number;
  level: number;
  /** Yours are only in `Near.you`. */
  auras: Aura[];
}

export interface Flight {
  now: number;
  /** 0 until the game says it. */
  max: number;
  /** What comes back each second, and what flying takes each second. */
  back: number;
  out: number;
  flying: boolean;
  at: number;
}

/** What is going on around you. None of it is kept. */
export interface Near {
  you: Unit | null;
  party: Unit[];
  target: Unit | null;
  /** The player you fought last. Gone seconds after. */
  foe: Unit | null;
  fighting: boolean;
  dungeon: number;
  /** When this run of the dungeon began. 0 outside one. */
  run: number;
  flight: Flight | null;
  /** In ms. -1 when not known. */
  ping: number;
  jitter: number;
  /** Odyle Energy: the daily part and the charged part. -1 when not known. */
  odyle: [daily: number, charged: number];
}

/** What your character has left. Yours alone, and not kept. */
export interface Entries {
  /** The game's own number for it, what it says first and what second: likely what is left, and more on top. */
  counts: [id: number, first: number, second: number][];
  /** -1 when not known, like the others. */
  duty: [done: number, taken: number];
  points: [now: number, most: number];
  kinah: number;
}

/** Something that just happened. */
export interface Happened {
  /** Yours, but for `blow`, `begin` and `use`, which are a monster's: a hit, a cast bar beginning, a skill going off. `big` is your biggest hit with a skill since the engine connected. */
  what: "cast" | "blow" | "begin" | "use" | "kill" | "assist" | "death" | "points" | "big";
  at: number;
  skill: number;
  name: string;
  amount: number;
}

/** Where you are, in metres, as the game last said it. Yours alone, and not kept. */
export interface Position {
  /** The game's number for the map. */
  map: number;
  /** Not said on this map yet: only the map is known. */
  known: boolean;
  x: number;
  y: number;
  z: number;
  /** When the game said it, by this PC's clock. */
  at: number;
}

/** Your pets, as the game says them: all at login, then souls gained and levels reached. */
export interface Pets {
  what: "all" | "souls" | "level";
  levels: [pet: number, level: number][];
  /** Towards the next level with `all`, gained with `souls`. */
  souls: [pet: number, souls: number][];
}

export const NO_NEAR: Near = {
  you: null, party: [], target: null, foe: null, fighting: false, dungeon: 0, run: 0, flight: null, ping: -1, jitter: -1, odyle: [-1, -1],
};

export const NO_ENTRIES: Entries = { counts: [], duty: [-1, -1], points: [-1, -1], kinah: -1 };

export type Status = "off" | "missing" | "starting" | "running" | "failed";

export type Message =
  | ({ t: "state" } & State)
  | ({ t: "reads" } & Reads)
  | ({ t: "fight" } & Fight)
  | { t: "skills"; id: number; skills: Skill[] }
  | ({ t: "near" } & Near)
  | ({ t: "entries" } & Entries)
  | ({ t: "place" } & Position)
  | ({ t: "pets" } & Pets)
  | { t: "cooldowns"; /** Skill and ms left, when the game said it. */ list: [skill: number, ms: number][]; at: number }
  | ({ t: "happened" } & Happened);

export const NO_FIGHT: Fight = {
  mode: "",
  target: { name: "", code: 0, hp: -1, maxHp: 0, boss: false, stagger: -1, dummy: false },
  targets: [],
  ms: 0,
  total: 0,
  timeup: false,
  dungeon: 0,
  own: [0, 0, 0],
  rows: [],
};
