// What lies deeper in a kept fight: rates, the opener, buffs by skill, ping, and whether a training run was clean.
import type { Buff, FightRow, Saved, Skill } from "../../live/types.ts";
import { clock, short } from "../../ui/format.ts";
import { casts, gaps, type Cast } from "./logic.ts";

export interface Rate {
  name: string;
  /** 0 to 1. */
  share: number;
  tip: string;
}

/** How a player's direct hits landed. What the fight does not hold is left out. */
export function rates(skills: readonly Skill[] = []): Rate[] {
  const direct = skills.filter((s) => !s.dot);
  const sum = (of: (s: Skill) => number | undefined) => direct.reduce((n, s) => n + (of(s) ?? 0), 0);
  const hits = sum((s) => s.hits);
  if (!hits) return [];
  const has = (of: (s: Skill) => number | undefined) => direct.some((s) => of(s) !== undefined);
  const all: [string, (s: Skill) => number | undefined][] = [
    ["Crit", (s) => s.crits], ["Back", (s) => s.backs], ["Perfect", (s) => s.perfects], ["Double", (s) => s.doubles],
    ["With extra hits", (s) => s.multis], ["Parried by the enemy", (s) => s.parries],
  ];
  return all.filter(([, of]) => has(of)).map(([name, of]) => ({ name, share: sum(of) / hits, tip: `${sum(of)} of ${hits} hits` }));
}

/** Your first casts, at most `most` of them. */
export const opening = (fight: Pick<Saved, "casts">, ms = 20_000, most = 24): Cast[] => casts(fight.casts).filter((c) => c.ms <= ms).slice(0, most);

export interface BySkill {
  buffs: Buff[];
  /** Casts of each skill, with the share of them that had each of `buffs`. */
  rows: { skill: number; casts: number; shares: number[] }[];
}

/** How many of each skill's casts had each buff: those on you, and yours on the target. Always or never on says nothing. */
export function buffsBySkill(fight: Saved, columns = 8, lines = 12): BySkill {
  const you = fight.you?.id;
  const coming = (b: Buff) => b.up > fight.ms * 0.02 && b.up < fight.ms * 0.98;
  const buffs = (fight.buffs ?? [])
    .filter((b) => !b.passive && (b.on === you || b.by === you) && !(fight.rows ?? []).some((r) => r.id === b.on && !r.you) && coming(b))
    .sort((a, b) => b.up - a.up)
    .slice(0, columns);
  const by = new Map<number, { damage: number; at: number[] }>();
  for (const { ms, skill, damage } of casts(fight.casts)) {
    const s = by.get(skill) ?? { damage: 0, at: [] };
    by.set(skill, s);
    s.damage += damage;
    s.at.push(ms);
  }
  const rows = [...by]
    .sort((a, b) => b[1].damage - a[1].damage)
    .slice(0, lines)
    .map(([skill, { at }]) => ({
      skill,
      casts: at.length,
      shares: buffs.map((b) => at.filter((t) => b.spans.some(([from, to]) => t >= from && t <= to)).length / at.length),
    }));
  return { buffs, rows: buffs.length ? rows : [] };
}

export interface Pings {
  /** Each second, the last one known. */
  line: number[];
  least: number;
  most: number;
  average: number;
}

export function pings(fight: Pick<Saved, "pings" | "ms">): Pings | undefined {
  const list = fight.pings ?? [];
  if (list.length < 2) return undefined;
  const values = list.map((p) => p[1]);
  let at = 0;
  const line = Array.from({ length: Math.floor(fight.ms / 1000) + 1 }, (_, s) => {
    while (at + 1 < list.length && list[at + 1][0] <= s * 1000) at++;
    return list[at][1];
  });
  return { line, least: Math.min(...values), most: Math.max(...values), average: Math.round(values.reduce((a, b) => a + b, 0) / values.length) };
}

/** What kept a training run from being clean. Nothing when it was. */
export function unclean(fight: Saved): string[] {
  if (!fight.dummy) return [];
  const why: string[] = [];
  if (fight.ms < 30_000) why.push("it was shorter than 30 s");
  const still = gaps(fight);
  if (still.length) why.push(`you paused ${still.length === 1 ? `at ${clock(still[0].from)}` : `${still.length} times`}`);
  if (fight.players > 1) why.push("someone else hit it too");
  const given = (fight.buffs ?? []).filter((b) => !b.passive && b.on === fight.you?.id && b.by !== fight.you?.id);
  if (given.length) why.push(`you had a buff from someone else${given[0].name ? `, ${given[0].name}` : ""}`);
  return why;
}

/** Everyone's damage by second, when the fight is of this session. */
export function partyCurve(fight: Saved): number[] | undefined {
  const curves = (fight.rows ?? []).map((r) => r.curve ?? []).filter((c) => c.length);
  if (curves.length < 2) return undefined;
  const seconds = Math.max(...curves.map((c) => c.length));
  return Array.from({ length: seconds }, (_, s) => curves.reduce((sum, c) => sum + c[Math.min(s, c.length - 1)], 0));
}

export interface Player {
  id: number;
  dps: number;
  /** With what their buffs gave others, and without what others' gave them. Nothing when what it needs was not measured. */
  rdps?: number;
  ndps?: number;
  hps: number;
  /** How long their passing buffs were on others, all added up, in ms. */
  support: number;
  /** The part of their healing that was too much, 0 to 1. Nothing when it could not be weighed. */
  over?: number;
}

/** The part of some heals that was too much, 0 to 1, of what could be weighed. An estimate. */
export function overheal(heals: readonly Skill[] = []): number | undefined {
  const sum = (of: (s: Skill) => number | undefined) => heals.reduce((n, s) => n + (of(s) ?? 0), 0);
  const weighed = sum((s) => s.weighed);
  return weighed > 0 ? sum((s) => s.over) / weighed : undefined;
}

/** What each player did for the others. The rDPS of all add up to the DPS of all. */
export function players(fight: Saved): Player[] {
  const rows = fight.rows ?? (fight.you ? [fight.you] : []);
  const ids = new Set(rows.map((r) => r.id));
  const seconds = Math.max(1, fight.ms / 1000);
  return rows.map((r) => ({
    id: r.id,
    dps: r.damage / seconds,
    rdps: r.got === undefined || r.given === undefined ? undefined : (r.damage - r.got + r.given) / seconds,
    ndps: r.got === undefined ? undefined : (r.damage - r.got) / seconds,
    hps: (r.healing ?? 0) / seconds,
    support: (fight.buffs ?? []).filter((b) => !b.passive && b.by === r.id && b.on !== r.id && ids.has(b.on)).reduce((n, b) => n + b.up, 0),
    over: overheal(r.heals),
  }));
}

export interface Mvp {
  id: number;
  points: number;
  damage: number;
  healing: number;
  stagger: number;
  deaths: number;
}

/** What each part of the MVP's points is worth at most. */
const WORTH = { damage: 100, healing: 25, stagger: 15, death: 10 } as const;

const useful = (r: FightRow) => (r.healing ?? 0) * (1 - (overheal(r.heals) ?? 0));

/**
 * Who did how much for a party, the most first. Our own rule: the share of the damage with buffs counted, of the healing that
 * did something and of the stagger, less ten for each death. Healing counts by how much of what hit the party it made good.
 */
export function standing(fight: Saved): Mvp[] {
  const rows = fight.rows ?? [];
  if (fight.dummy || rows.length < 2) return [];
  const credited = (r: FightRow) => Math.max(0, r.damage - (r.got ?? 0) + (r.given ?? 0));
  const all = (of: (r: FightRow) => number) => Math.max(1, rows.reduce((n, r) => n + of(r), 0));
  const needed = Math.max(all((r) => r.taken), all(useful));
  return rows.map((r) => {
    const damage = (WORTH.damage * credited(r)) / all(credited);
    const healing = (WORTH.healing * useful(r)) / needed;
    const stagger = (WORTH.stagger * (r.stagger ?? 0)) / all((x) => x.stagger ?? 0);
    const deaths = WORTH.death * r.deaths;
    return { id: r.id, points: damage + healing + stagger - deaths, damage, healing, stagger, deaths };
  }).sort((a, b) => b.points - a.points || a.id - b.id);
}

export const mvp = (fight: Saved): Mvp | undefined => standing(fight)[0];

/** What some players did best, in a few words. Nobody has two, and what the best of already has one is nobody's. */
export function titles(fight: Saved): Map<number, string> {
  const rows = fight.rows ?? [];
  const all = new Map<number, string>();
  if (fight.dummy || rows.length < 2) return all;
  const give = (of: (r: FightRow) => number, least: number, words: (n: number) => string) => {
    const best = rows.reduce((a, b) => (of(b) > of(a) ? b : a));
    if (of(best) >= least && !all.has(best.id)) all.set(best.id, words(of(best)));
  };
  const percents = (n: number) => `${Math.round(n * 100)}%`;
  const broken = rows.reduce((n, r) => n + (r.stagger ?? 0), 0);
  const during = (r: FightRow, from: number, to: number) => {
    const c = r.curve ?? [];
    const at = (part: number) => (part <= 0 ? 0 : (c[Math.min(c.length, Math.ceil(c.length * part)) - 1] ?? 0));
    return at(to) - at(from);
  };
  give((r) => useful(r), 1, (n) => `Most healing, ${short(n)}`);
  give((r) => (broken > 0 ? (r.stagger ?? 0) / broken : 0), 0.25, (n) => `${percents(n)} of the stagger`);
  give((r) => r.given ?? 0, 1, (n) => `Buffs gave ${short(n)}`);
  give((r) => Math.max(0, ...r.skills.filter((s) => !s.dot).map((s) => s.max)), 1, (n) => `Biggest hit, ${short(n)}`);
  give((r) => during(r, 0.8, 1), 1, () => "Strongest at the end");
  give((r) => during(r, 0, 20_000 / Math.max(20_000, fight.ms)), 1, () => "Strongest start");
  give((r) => rates(r.skills).find((x) => x.name === "Crit")?.share ?? 0, 0.01, (n) => `Most critical hits, ${percents(n)}`);
  return all;
}
