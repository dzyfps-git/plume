// A made-up fight, to place overlays by and to try the app without the game.
import type { Fight, Job, Skill } from "./types";

const PARTY: [string, Job, number][] = [
  ["You", "assassin", 46_200],
  ["Maren", "sorcerer", 43_800],
  ["Tolvi", "ranger", 39_500],
  ["Brisa", "spiritmaster", 33_100],
  ["Oskar", "gladiator", 29_700],
  ["Wren", "templar", 18_900],
  ["Ilse", "chanter", 15_400],
  ["Pell", "cleric", 9_200],
];
const LENGTH = 180_000;
const MAX_HP = 43_000_000;

/** The fight `ms` after it began. It starts again when the boss falls. */
export function demoFight(ms: number): Fight {
  const now = ms % LENGTH;
  const seconds = Math.max(1, now / 1000);
  // Each player has a rhythm of their own, so places are taken and lost. Nobody's damage ever falls.
  const damage = PARTY.map(([, , dps], i) => {
    const beat = 7 + i * 1.3;
    return Math.round(dps * (seconds + 0.7 * beat * (Math.sin(seconds / beat + i) - Math.sin(i))));
  });
  const total = damage.reduce((a, b) => a + b, 0);
  const rows = PARTY.map(([name, job], i) => ({
    id: i + 1,
    name,
    job,
    damage: damage[i],
    dps: Math.round(damage[i] / seconds),
    share: Math.round((damage[i] / total) * 1000) / 10,
    you: i === 0,
    deaths: i === 5 && now > 90_000 ? 1 : 0,
    taken: 0,
    hps: i === 7 ? 8_400 : 0,
    power: 0,
  })).sort((a, b) => b.damage - a.damage);
  return {
    mode: "bossTargets",
    target: {
      name: "Stormbound Warden",
      code: -1,
      hp: Math.max(0, MAX_HP - total),
      maxHp: MAX_HP,
      boss: true,
      stagger: (now / 250) % 100,
    },
    targets: [1],
    ms: now,
    total,
    timeup: false,
    dungeon: 0,
    rows,
  };
}

const SKILLS: [string, number, boolean][] = [
  ["Heart Gore", 0.27, false],
  ["Quick Slice", 0.21, false],
  ["Ambush", 0.17, false],
  ["Venom", 0.14, true],
  ["Whirling Edge", 0.12, false],
  ["Basic Attack", 0.09, false],
];

export const demoSkills = (total: number): Skill[] =>
  SKILLS.map(([name, share, dot], i) => {
    const damage = Math.round(total * share);
    const hits = Math.max(1, Math.round(damage / (9_000 - i * 1_100)));
    return {
      code: i, name, dot, hits, damage,
      crits: dot ? 0 : Math.round(hits * 0.44),
      backs: Math.round(hits * 0.61),
      perfects: Math.round(hits * 0.12),
      doubles: Math.round(hits * 0.08),
      min: Math.round((damage / hits) * 0.6),
      max: Math.round((damage / hits) * 2.1),
    };
  });
