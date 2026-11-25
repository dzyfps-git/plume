// Boss calls as the engine's `tools/calls.py` writes them: the game's own boss lines, and short directions after A2Tools'.
import type { Aura } from "../../live/types.ts";

export interface GameCall {
  key: string;
  /** A cast bar beginning, a skill going off, or an effect on the boss. */
  t: "cast" | "use" | "abnormal";
  id: number;
  boss: string;
  /** The boss's own line, as the game shows it. */
  line: string;
  /** A word for what it means, when there is one. */
  short: string;
  /** What to do, for the Global game. Empty when not known for sure. */
  say: string;
  /** Ms from the cast bar to the hit. */
  lead?: number;
  /** The effect it puts on the boss, how long, and what to say while it lasts. */
  phase?: { a: number; ms: number; say: string };
}

export interface CallFile {
  safe: string;
  watch: string;
  bosses: Record<string, { name: string; group: string }>;
  calls: GameCall[];
}

export type CallMode = "say" | "line";

/** What is said: what to do, or the boss's line. */
export const words = (c: GameCall, mode: CallMode, file: Pick<CallFile, "watch">) =>
  (mode === "say" ? c.say || c.short || c.line : c.line || c.short) || file.watch;

/** Calls a cast, a use or an effect starts. Those turned off are not. */
export const heard = (file: CallFile, t: GameCall["t"], id: number, off: readonly string[]) =>
  file.calls.filter((c) => c.t === t && c.id === id && !off.includes(c.boss) && !off.includes(c.key));

export interface Shown {
  call: GameCall;
  /** When its countdown ends, 0 for none. */
  end: number;
  /** It is a phase: "safe" follows when it is over. */
  phase: boolean;
}

/**
 * Effects on the boss, against those already seen: the calls they start, and whether a phase just ended with none left.
 * `seen` maps an effect's key to whether it is a phase.
 */
export function onBoss(file: CallFile, auras: readonly Aura[], seen: ReadonlyMap<string, boolean>, off: readonly string[], now: number) {
  const shown: Shown[] = [];
  const next = new Map<string, boolean>();
  for (const a of auras) {
    const phases = file.calls.filter((c) => c.phase?.a === a.id && !off.includes(c.boss) && !off.includes(c.key));
    const ends = (ms: number) => (a.end > now ? a.end : now + ms);
    if (!seen.has(a.key)) {
      for (const c of heard(file, "abnormal", a.id, off)) shown.push({ call: c, end: a.end > now ? a.end : 0, phase: false });
      for (const c of phases) shown.push({ call: c, end: ends(c.phase!.ms), phase: true });
    }
    next.set(a.key, phases.length > 0);
  }
  const was = [...seen.values()].some(Boolean);
  const still = [...next.values()].some(Boolean);
  return { shown, seen: next, safe: was && !still };
}
