// What your own pulls of a boss teach about it.
import type { Saved } from "../../live/types.ts";
import type { BossPlan, Timer } from "../../store/settings.ts";

/** A hit that comes within this of its usual time is the same hit. */
const SPREAD = 4_000;
/** The share of pulls long enough to see it in which it came. */
const OFTEN = 0.6;

export const key = (fight: { code: number; target: string }) => String(fight.code || fight.target);

export interface Learned extends Timer {
  /** What it does to each player it hits, on average. */
  damage: number;
  /** Pulls it was seen in. */
  pulls: number;
}

const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Big hits that come at about the same time each pull. `pulls` are whole fights of one boss. */
export function learn(pulls: readonly Saved[]): Learned[] {
  const seen = pulls.filter((p) => p.blows?.length);
  if (seen.length < 2) return [];
  const skills = new Map<number, { name: string; hits: number; damage: number; times: number[][] }>();
  seen.forEach((pull, n) => {
    for (const [ms, skill, hits, damage] of pull.blows!) {
      const s = skills.get(skill) ?? { name: "", hits: 0, damage: 0, times: seen.map(() => []) };
      skills.set(skill, s);
      s.name ||= pull.names?.[skill] ?? "";
      s.hits += Math.max(1, hits);
      s.damage += damage;
      s.times[n].push(ms);
    }
  });
  const each = [...skills.values()].map((s) => s.damage / s.hits);
  // What hits no harder than most is not worth a warning.
  const usual = median(each);
  return [...skills]
    .flatMap(([skill, s]) => {
      const damage = s.damage / s.hits;
      if (skills.size > 1 && damage <= usual && damage < Math.max(...each)) return [];
      const at: number[] = [];
      let found = 0;
      // Every time it came is tried: a hit missing from one pull may be in the others.
      for (const seed of s.times.flat().sort((a, b) => a - b)) {
        const near = s.times.flatMap((list) => list.filter((t) => Math.abs(t - seed) <= SPREAD).slice(0, 1));
        const could = seen.filter((p) => p.ms >= seed).length;
        if (near.length < 2 || near.length / Math.max(1, could) < OFTEN) continue;
        const when = Math.round(median(near) / 1000);
        if (at.some((t) => Math.abs(t - when) <= SPREAD / 1000)) continue;
        found = Math.max(found, near.length);
        at.push(when);
      }
      return at.length ? [{ skill, name: s.name || `Skill ${skill}`, at, damage, pulls: found }] : [];
    })
    .sort((a, b) => b.damage - a.damage);
}

/** Hits that are soon: how long until each, the nearest first. */
export function upcoming(timers: readonly Timer[], ms: number, ahead = 30_000): { name: string; in: number; at: number }[] {
  return timers
    .flatMap((t) => t.at.map((at) => ({ name: t.name, in: at * 1000 - ms, at })))
    .filter((t) => t.in > -500 && t.in <= ahead)
    .sort((a, b) => a.in - b.in);
}

export interface HitBy {
  skill: number;
  name: string;
  /** Hits on you in all these pulls, and in the last of them. */
  hits: number;
  last: number;
  damage: number;
}

/** What hit you, the most damage first. `pulls` newest first. */
export function hitBy(pulls: readonly Saved[]): HitBy[] {
  const all = new Map<number, HitBy>();
  pulls.forEach((p, n) => {
    for (const [, skill, damage] of p.taken ?? []) {
      const h = all.get(skill) ?? { skill, name: p.names?.[skill] ?? `Skill ${skill}`, hits: 0, last: 0, damage: 0 };
      all.set(skill, h);
      h.hits++;
      h.damage += damage;
      if (n === 0) h.last++;
    }
  });
  return [...all.values()].sort((a, b) => b.damage - a.damage);
}

/** Avoidable hits in each pull, oldest first. `pulls` newest first. */
export const trend = (pulls: readonly Saved[], avoid: readonly number[]): number[] =>
  pulls.map((p) => (p.taken ?? []).filter((t) => avoid.includes(t[1])).length).reverse();

/** "1:30", "90", "45s", "2m" or "1m30" as seconds. */
export function seconds(text: string): number | undefined {
  const found = text.trim().toLowerCase().match(/^(?:(\d{1,2})\s*[:m]\s*(\d{1,2})?|(\d{1,4}))\s*s?$/);
  if (!found) return undefined;
  return found[3] ? Number(found[3]) : Number(found[1]) * 60 + Number(found[2] ?? 0);
}

/** Where the target's health should be now, 0 to 1, to fall just as it enrages. */
export const pace = (ms: number, enrage: number) => (enrage > 0 ? Math.max(0, 1 - ms / (enrage * 1000)) : undefined);

/** What to say out loud between two looks at a fight. `share` is the target's health, 0 to 1. */
export function calls(plan: BossPlan, before: { ms: number; share: number }, now: { ms: number; share: number }, lead: number): string[] {
  const all: string[] = [];
  if (now.ms < before.ms) return all;
  for (const mark of plan.marks) if (before.share > mark / 100 && now.share <= mark / 100) all.push(`${mark} percent`);
  const passed = (at: number) => before.ms < at && now.ms >= at;
  for (const t of plan.timers) for (const at of t.at) if (passed((at - lead) * 1000)) all.push(t.name);
  for (const s of [30, 10]) if (plan.enrage > s && passed((plan.enrage - s) * 1000)) all.push(`Enrage in ${s}`);
  return all;
}
