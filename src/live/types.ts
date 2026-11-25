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
  skills: Skill[];
}

/** A finished fight. The list gives it without `curve`, `rows` and skills. */
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
  /** Your own total after each second. */
  curve?: number[];
  you: FightRow | null;
  /** Everyone else's damage, as one sum. */
  others: number;
  players: number;
  /** Only for a fight of this session. Never written to disk. */
  rows?: FightRow[];
}

export type Status = "off" | "missing" | "starting" | "running" | "failed";

export type Message =
  | ({ t: "state" } & State)
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
