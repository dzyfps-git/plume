// Events on the server's clock, the stopwatch, and odds. Times after IDEAS.md "Recharges and times": NC has published none.

/** The server's clock is UTC+9 in every Global region. */
export const SERVER = 9 * 3_600_000;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const hours = (from: number, step: number) => Array.from({ length: Math.ceil((24 - from) / step) }, (_, i) => (from + i * step) * 60);

export interface GameEvent {
  id: string;
  name: string;
  /** Days of the week on the server's clock, 0 is Sunday. None is every day. */
  days?: number[];
  /** Minutes after midnight on the server's clock. */
  times: number[];
  /** Minutes it stays open. */
  lasts: number;
  /** The game's picture for it. */
  icon: string;
}

export const EVENTS: GameEvent[] = [
  { id: "shugo", name: "Shugo Festival", times: hours(0, 1), lasts: 3, icon: "Icon_Currency_Treasure_Key_Legend_004" },
  { id: "invasion", name: "Dimensional Invasion", times: hours(0, 1).map((m) => m + 30), lasts: 3, icon: "Icon_Currency_Treasure_Key_Legend_006" },
  { id: "rift", name: "Spacetime Rift", times: hours(0, 3), lasts: 10, icon: "UT_Marker_Rift" },
  { id: "kaira", name: "Watcher Kaira", times: hours(1, 3), lasts: 30, icon: "UT_Marker_Monster_Boss_Aggressive" },
  { id: "argo", name: "Argo, the Spirit King", times: [10 * 60 + 30, 22 * 60 + 30], lasts: 30, icon: "UT_Marker_Monster_Boss_Aggressive" },
  { id: "arena", name: "Arena of Tactics", times: [11 * 60, 19 * 60], lasts: 120, icon: "UT_Marker_ArenaCar" },
  { id: "siege", name: "Artifact Siege", days: [1, 4, 6], times: [21 * 60], lasts: 60, icon: "UT_Marker_AbyssArtifact_Neutral" },
  { id: "abyss", name: "Executors and Middle Abyss bosses", days: [1, 4, 6], times: [21 * 60 + 30], lasts: 30, icon: "UT_Marker_Monster_Boss" },
  { id: "nahma", name: "Guardian Lord Nahma", days: [0, 5], times: [21 * 60], lasts: 30, icon: "UT_Marker_Monster_Boss_Aggressive" },
];

export interface Next {
  event: GameEvent;
  start: number;
  /** It is open now. */
  open: boolean;
}

/** The next start of an event that has not ended yet, in PC time. */
export function next(e: GameEvent, now: number): Next {
  // Arena is open 11 to 14: its first window is three hours, its second two.
  const lasts = (t: number) => (e.id === "arena" && t === 11 * 60 ? 180 : e.lasts);
  const midnight = Math.floor((now + SERVER) / DAY) * DAY - SERVER;
  for (let d = -1; d <= 8; d++) {
    const day = midnight + d * DAY;
    const weekday = new Date(day + SERVER).getUTCDay();
    if (e.days && !e.days.includes(weekday)) continue;
    for (const t of e.times) {
      const start = day + t * MIN;
      if (start + lasts(t) * MIN > now) return { event: e, start, open: start <= now };
    }
  }
  throw new Error(`no start for ${e.id}`);
}

/** All but those turned off, soonest first. */
export const upcoming = (now: number, off: readonly string[]) =>
  EVENTS.filter((e) => !off.includes(e.id)).map((e) => next(e, now)).sort((a, b) => a.start - b.start);

/** 21:05 on the server's clock. */
export const serverTime = (now: number) => new Date(now + SERVER).toISOString().slice(11, 16);

/** The stopwatch and the countdown, as times in ms; 0 is not running. */
export interface Clock {
  start: number;
  /** When it was stopped, 0 while it runs. */
  stopped: number;
  /** A countdown's end. */
  end: number;
}

export const elapsed = (c: Clock, now: number) => (c.start ? (c.stopped || now) - c.start : 0);

/** Stops a running stopwatch, goes on with a stopped one, or starts one. */
export function toggle(c: Clock, now: number): Clock {
  if (!c.start) return { ...c, start: now, stopped: 0 };
  if (!c.stopped) return { ...c, stopped: now };
  return { ...c, start: c.start + now - c.stopped, stopped: 0 };
}

/** Tries at `chance` (0 to 1) each: on average, and those that half and nine in ten of players need at most. */
export function odds(chance: number) {
  if (!(chance > 0)) return undefined;
  if (chance >= 1) return { mean: 1, half: 1, most: 1 };
  const within = (p: number) => Math.max(1, Math.ceil(Math.log(1 - p) / Math.log(1 - chance)));
  return { mean: 1 / chance, half: within(0.5), most: within(0.9) };
}
