// A made-up fight, to place overlays by and to try the app without the game.
import type { Aura, Buff, Entries, Entry, Fight, FightRow, Job, Near, Saved, Skill, StaggerWindow, Unit } from "./types";

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
    taken: Math.round(seconds * (i === 5 ? 2_900 : 700 + i * 40)),
    hps: i === 7 ? 8_400 : i === 6 ? 2_100 : 0,
    power: 98_400 + i * 2_350,
    level: 2_040 + i * 60,
    healing: Math.round(seconds * (i === 7 ? 8_400 : i === 6 ? 2_100 : 0)),
    hits: Math.round(seconds * (2.2 + i * 0.2)),
    given: i === 6 ? Math.round(damage[0] * 0.08) + Math.round(damage[1] * 0.08) : 0,
    got: i < 2 ? Math.round(damage[i] * 0.08) : 0,
    others: false,
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
      dummy: false,
    },
    targets: [1],
    ms: now,
    total,
    timeup: false,
    dungeon: 0,
    own: [Math.round(seconds * 2.2), Math.round(seconds * 0.97), Math.round(seconds * 1.34)],
    rows,
  };
}

export const demoAura = (id: number, name: string, more: Partial<Aura> = {}): Aura => ({
  key: `${id}:${more.by ?? 1}`, id, name, skill: 0, bad: false, tag: "", item: false, by: 1, yours: false, foe: false, stacks: 1, start: 0, end: 0, ...more,
});

/** What is around you `ms` into a made-up fight. `at` is the time on the clock. */
export function demoNear(ms: number, at: number): Near {
  // An effect that comes again every so often, and stays a while.
  const cycle = (every: number, long: number, shift = 0): Pick<Aura, "start" | "end"> | undefined => {
    const into = (ms + shift) % every;
    return into < long ? { start: at - into, end: at - into + long } : undefined;
  };
  const list = (...all: (Aura | undefined)[]) => all.filter((a) => a !== undefined);
  const aura = (id: number, name: string, time: ReturnType<typeof cycle>, more: Partial<Aura> = {}) => time && demoAura(id, name, { ...time, ...more });
  const wave = (least: number, beat: number, shift: number) => least + (1 - least) * (0.5 + 0.5 * Math.sin(ms / beat + shift));
  const unit = (i: number, hp: number, auras: Aura[]): Unit => ({
    key: String(i + 1), id: i + 1, name: PARTY[i][0], job: PARTY[i][1], you: i === 0, boss: false, hp: Math.round(hp * 42_000), maxHp: 42_000, power: 98_400 + i * 2_350, level: 2_040 + i * 60, auras,
  });
  const wind = (i: number) => aura(904, "Word of Wind", i < 6 ? cycle(30_000, 22_000) : undefined, { by: 7 });
  const you = unit(0, wave(0.15, 5_000, 0), list(
    aura(900, "Swift Contract", cycle(20_000, 15_000), { yours: true }),
    aura(902, "Shadow Edge", cycle(26_000, 9_000, 4_000), { yours: true, stacks: 3 }),
    wind(0),
    demoAura(910, "Herb Soup", { item: true, start: at - 600_000, end: at + 900_000 - ms }),
    aura(920, "Storm Mark", cycle(18_000, 6_000, 7_000), { bad: true, by: 900 }),
    aura(921, "Thunder Stomp", cycle(6_000, 3_500, 2_000), { bad: true, tag: "stun", by: 900 }),
  ));
  return {
    you,
    party: PARTY.map((_, i) => unit(i, i === 5 && ms % 60_000 > 50_000 ? 0 : i === 0 ? you.hp / 42_000 : wave(0.2 + i * 0.08, 6_000 + i * 900, i * 2), i === 0 ? [] : list(
      wind(i), aura(920, "Storm Mark", cycle(20_000, 6_000, i * 5_000), { bad: true, by: 900 }), aura(930, "Venom", i === 2 ? cycle(15_000, 8_000) : undefined, { bad: true, by: 900 }),
    ))),
    target: {
      key: "900", id: 900, name: "Stormbound Warden", job: "", you: false, boss: true, hp: Math.round(43_000_000 * (1 - (ms % LENGTH) / LENGTH)), maxHp: 43_000_000, power: 0, level: 0,
      auras: list(
        aura(901, "Heart Gore", cycle(12_000, 8_000), { bad: true, yours: true }),
        aura(931, "Sunder", cycle(25_000, 15_000), { bad: true, by: 5, stacks: 4 }),
        aura(940, "Storm Shell", cycle(45_000, 8_000, 20_000), { tag: "safe", by: 900 }),
      ),
    },
    foe: {
      key: "50", id: 50, name: "Rival", job: "ranger", you: false, boss: false, hp: Math.round(38_000 * wave(0.3, 7_000, 3)), maxHp: 38_000, power: 0, level: 0,
      auras: list(aura(950, "Hawk Eye", cycle(16_000, 10_000), { by: 50 }), aura(901, "Heart Gore", cycle(12_000, 5_000, 3_000), { bad: true, yours: true })),
    },
    fighting: true,
    dungeon: 600_091,
    run: at - ms - 400_000,
    flight: { now: 60 - ((ms / 1000) % 50), max: 60, back: 2, out: 1, flying: true, at },
    ping: 38 + Math.round(6 * Math.sin(ms / 3_000)),
    jitter: 4,
    odyle: [420, 35],
  };
}

export const demoEntries = (): Entries => ({ counts: [[1, 5, 1], [4, 2, 0], [60_000_002, 2, 1], [80_000_001, 0, 5]], duty: [3, 5], points: [1_240, 5_000], kinah: 182_300 });

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
      multis: Math.round(hits * 0.3),
      extras: Math.round(hits * 0.3) * 2,
      bonus: Math.round(damage * 0.12),
      parries: Math.round(hits * 0.02),
      blocks: 0,
      fronts: 0,
      min: Math.round((damage / hits) * 0.6),
      max: Math.round((damage / hits) * 2.1),
    };
  });

const NAMES: Record<string, string> = Object.fromEntries([
  ...SKILLS.map(([name], i) => [String(i), name]),
  ["101", "Thunder Stomp"], ["102", "Storm Breath"], ["103", "Claw"],
]);
const ROTATION: [skill: number, every: number, damage: number][] = [
  [0, 12_000, 64_000], [2, 18_000, 52_000], [4, 8_000, 21_000], [1, 2_600, 11_000], [5, 1_400, 4_200],
];

/** A made-up fight as it is kept. `seed` changes the luck, `skill` how well it is played, 1 being well. */
export function demoSaved(id: string, options: { ms: number; seed?: number; skill?: number; dummy?: boolean; killed?: boolean; start?: number; run?: number }): Saved {
  const { ms, seed = 1, skill = 1, dummy = false, killed = false, start = 0, run = 0 } = options;
  let state = seed * 7919;
  const luck = () => ((state = (state * 48_271) % 2_147_483_647) / 2_147_483_647);
  const died = !dummy && !killed ? ms - 14_000 : -1;

  const casts: Entry[] = [];
  const ready = ROTATION.map(() => 0);
  for (let now = 400; now < ms; now += 1_000 + luck() * 250 * (2 - skill)) {
    // A pause now and then, longer the worse it is played.
    if (luck() > 0.93 * skill + 0.05) now += 2_500 + luck() * 2_500;
    if (died >= 0 && now > died) break;
    const next = ready.findIndex((at) => at <= now);
    const [code, every, base] = ROTATION[next < 0 ? 4 : next];
    if (next >= 0) ready[next] = now + every;
    const crit = luck() < 0.44;
    const strong = now % 30_000 < 12_000 ? 1.12 : 1;
    const damage = Math.round(base * (0.95 + luck() * 0.1) * (crit ? 1.6 : 1) * strong);
    casts.push([Math.round(now), code, damage, (crit ? 1 : 0) | (luck() < 0.6 ? 2 : 0)]);
    if (code === 2) for (let t = 1; t <= 4; t++) casts.push([Math.round(now + t * 1_000), 3, 3_100, 256]);
  }
  // Nobody can hit it for ten seconds in the middle.
  const away = (s: number) => !dummy && s >= 60 && s < 70;
  casts.splice(0, casts.length, ...casts.filter((c) => c[0] <= ms && !away(c[0] / 1000)).sort((a, b) => a[0] - b[0]));

  const seconds = Math.floor(ms / 1000) + 1;
  const curve = Array.from({ length: seconds }, (_, s) => casts.reduce((sum, c) => (c[0] < (s + 1) * 1000 ? sum + c[2] : sum), 0));
  const mine = curve[curve.length - 1];
  const others = dummy ? [] : PARTY.slice(1);
  const theirs = (dps: number) => {
    let total = 0;
    return Array.from({ length: seconds }, (_, s) => (total += away(s) ? 0 : dps));
  };

  const blows: Entry[] = [];
  const taken: Entry[] = [];
  let hp = 42_000;
  for (let t = 4_000; !dummy && t < ms; t += 4_000) {
    const code = t % 32_000 === 20_000 ? 101 : t % 48_000 === 36_000 ? 102 : 103;
    const size = { 101: 14_000, 102: 22_000, 103: 2_400 }[code]!;
    const at = t + Math.round(luck() * 600);
    const hits = code === 103 ? 1 : 3 + Math.floor(luck() * 4);
    blows.push([at, code, hits, size * hits]);
    if ((died < 0 || at <= died) && (code !== 103 || luck() < 0.4) && luck() < 1.5 - skill) {
      hp = Math.max(1, hp - size);
      taken.push([at, code, size, hp]);
      if (hp < 15_000) hp = 42_000;
    }
  }
  if (died >= 0) taken.push([died - 2_000, 103, 2_400, 18_200], [died - 100, 102, 22_000, 0]);
  taken.sort((a, b) => a[0] - b[0]);

  const spans = (every: number, long: number, stacks = 1): Buff["spans"] =>
    Array.from({ length: Math.ceil(ms / every) }, (_, i) => [i * every, Math.min(ms, i * every + long), stacks]);
  const buff = (code: number, name: string, on: number, by: number, s: Buff["spans"], passive = false): Buff => ({
    id: code, name, on, by, skill: 0, passive, spans: passive ? [] : s, up: passive ? ms : s.reduce((sum, [a, b]) => sum + b - a, 0),
  });
  const buffs = [
    buff(900, "Swift Contract", 1, 1, spans(20_000, 15_000 * skill)),
    buff(901, "Heart Gore", 900_001, 1, spans(12_000, 8_000)),
    buff(902, "Shadow Edge", 1, 1, spans(26_000, 6_000)),
    buff(903, "Nimble Body", 1, 1, [], true),
    ...(dummy ? [] : [buff(904, "Word of Wind", 1, 7, spans(30_000, 12_000)), buff(904, "Word of Wind", 2, 7, spans(30_000, 12_000)), buff(905, "Rallying Song", 3, 7, spans(40_000, 10_000))]),
  ];

  const row = (i: number, name: string, job: Job, damage: number, dps: number[]): FightRow => ({
    id: i + 1, name, job, damage, dps: Math.round(damage / (ms / 1000)), share: 0, you: i === 0,
    deaths: i === 0 && died >= 0 ? 1 : 0, taken: i === 0 ? taken.reduce((sum, t) => sum + t[2], 0) : i === 5 ? 310_000 : 52_000 + i * 3_100,
    hitsTaken: i === 0 ? taken.length : 14, blocked: i === 5 ? 9 : 0,
    power: 98_400 + i * 2_350,
    healing: i === 7 ? Math.round(ms * 8.4) : i === 6 ? Math.round(ms * 2.1) : i === 0 ? Math.round(ms * 0.4) : 0,
    given: i === 6 ? Math.round(mine * 0.04) : 0, got: i === 0 && !dummy ? Math.round(mine * 0.04) : 0,
    stagger: dummy ? 0 : 900 - i * 80, curve: dps, skills: demoSkills(damage),
    heals: i === 7 ? demoSkills(Math.round(ms * 8.4)).slice(0, 3).map((s, n) => ({ ...s, name: ["Healing Wind", "Light of Dawn", "Radiant Cure"][n], weighed: s.damage, over: Math.round(s.damage * [0.51, 0.42, 0.18][n]) })) : [],
  });
  const rows = [row(0, "You", "assassin", mine, curve), ...others.map(([name, job, dps], i) => row(i + 1, name, job, theirs(dps)[seconds - 1], theirs(dps)))];
  const total = rows.reduce((sum, r) => sum + r.damage, 0);
  for (const r of rows) r.share = Math.round((r.damage / total) * 1000) / 10;
  rows.sort((a, b) => b.damage - a.damage);
  const maxHp = dummy ? 0 : killed ? total : Math.round(total * 1.4);
  const dealt = Array.from({ length: seconds }, (_, s) => rows.reduce((sum, r) => sum + r.curve![s], 0));
  return {
    id, target: dummy ? "Training dummy" : "Stormbound Warden", code: dummy ? -2 : -1, start, ms, total, maxHp, killed, dummy,
    dungeon: run ? 600_091 : 0, run, lost: 0, curve, casts, taken, blows, names: NAMES, buffs, rows,
    health: dummy ? [] : dealt.map((d) => Math.max(0, maxHp - d)),
    deaths: died >= 0 ? [{ id: 1, you: true, ms: died, up: -1, hits: taken.slice(-2) }, { id: 6, you: false, ms: died + 4_000, up: -1, hits: [[died + 3_900, 101, 14_000, 0]] }] : [],
    stagger: dummy ? [] : ([
      { start: 18_000, end: 47_000, broke: true, max: 1_000, by: { 1: 320, 5: 410, 6: 270 } },
      { start: 80_000, end: 110_000, broke: false, max: 1_000, by: { 1: 210, 5: 300 } },
    ] as StaggerWindow[]).filter((w) => w.end < ms),
    pings: Array.from({ length: Math.floor(ms / 5_000) + 1 }, (_, i): [number, number] => [i * 5_000, 38 + Math.round(6 * Math.sin(i))]),
    stats: { 1: 1_240 + seed * 10, 215: 300, 12: 88 },
    credits: dummy ? [] : [{ by: 7, to: 1, id: 904, name: "Word of Wind", damage: Math.round(mine * 0.04) }],
    you: rows.find((r) => r.you)!, others: total - mine, players: rows.length,
  };
}
