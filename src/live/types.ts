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
  min: number;
  max: number;
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
  healing?: number;
  given?: number;
  got?: number;
  stagger?: number;
  curve?: number[];
  skills: Skill[];
  heals?: Skill[];
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
  /** Only for a fight of this session. Never written to disk. */
  rows?: FightRow[];
  credits?: Credit[];
}

export type Status = "off" | "missing" | "starting" | "running" | "failed";

export type Message =
  | ({ t: "state" } & State)
  | ({ t: "reads" } & Reads)
  | ({ t: "fight" } & Fight)
  | { t: "skills"; id: number; skills: Skill[] };

export const NO_FIGHT: Fight = {
  mode: "",
  target: { name: "", code: 0, hp: -1, maxHp: 0, boss: false, stagger: -1 },
  targets: [],
  ms: 0,
  total: 0,
  timeup: false,
  dungeon: 0,
  rows: [],
};
