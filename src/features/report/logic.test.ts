import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSaved } from "../../live/demo.ts";
import type { Entry, Saved } from "../../live/types.ts";
import { figures, luck, skillGains, statChanges } from "./compare.ts";
import { activeDps, casts, chains, down, findings, gaps, left, opener, parts, procs, resultText, rhythm, starts, untouchable, waited, wipeLine } from "./logic.ts";

const base = demoSaved("x", { ms: 60_000, dummy: true });
const fight = (edit: Partial<Saved>): Saved => ({ ...base, casts: [], taken: [], blows: [], buffs: [], deaths: [], rows: undefined, ...edit });
const hit = (ms: number, skill = 1, damage = 10, flags = 0): Entry => [ms, skill, damage, flags];
const steady = (ms: number, every: number) => Array.from({ length: Math.floor(ms / every) }, (_, i) => hit(i * every + 100));

test("hits close together are one cast, and ticks are none", () => {
  const list = casts([hit(0), hit(300), hit(400, 2), hit(800), hit(900, 1, 5, 256), hit(5_000)]);
  assert.deepEqual(list.map((c) => [c.ms, c.skill, c.hits, c.damage]), [[0, 1, 3, 30], [400, 2, 1, 10], [5_000, 1, 1, 10]]);
  assert.deepEqual(casts(), []);
});

test("a gap is time you could have used", () => {
  const list = [...steady(20_000, 1_000), hit(30_000), hit(31_000), ...steady(8_000, 1_000).map((h) => hit(h[0] + 51_000))];
  const all = gaps(fight({ casts: list }));
  assert.deepEqual(all.map((g) => [g.from, g.to]), [[19_100, 30_000], [31_000, 51_100]]);
  const dead = gaps(fight({ casts: list, deaths: [{ id: 1, you: true, ms: 31_500, up: 50_800, hits: [] }] }));
  assert.deepEqual(dead.map((g) => g.from), [19_100]);
  // Time down is taken out of the gap, not counted in it.
  const part = gaps(fight({ casts: list, deaths: [{ id: 1, you: true, ms: 40_000, up: 45_000, hits: [] }] }));
  assert.deepEqual(part.map((g) => [g.from, g.to]), [[19_100, 30_000], [31_000, 40_000], [45_000, 51_100]]);
  assert.deepEqual(gaps(fight({ casts: [] })), []);
});

test("a target nobody can hit is told from you pausing", () => {
  const flat = [10, 20, 30, 30, 30, 30, 30, 40];
  const you = { ...base.you!, curve: flat };
  const boss = { dummy: false, ms: 8_000 };
  const still = { ...you, id: 99, curve: [5, 6, 7, 7, 7, 7, 7, 8] };
  assert.deepEqual(untouchable(fight({ ...boss, rows: [you, still], health: [] })), [{ from: 3_000, to: 7_000 }]);
  // You alone, or a dummy: a pause of yours is no proof.
  assert.deepEqual(untouchable(fight({ ...boss, rows: [you], health: [] })), []);
  assert.deepEqual(untouchable(fight({ ...boss, rows: [you], health: [9, 8, 7, 7, 7, 7, 7, 6] })), []);
  assert.deepEqual(untouchable(fight({ ms: 8_000, rows: [you, still], health: [] })), []);
  const other = { ...you, curve: [1, 2, 3, 4, 5, 6, 7, 8] };
  assert.deepEqual(untouchable(fight({ ...boss, rows: [you, other], health: [] })), []);
  assert.deepEqual(untouchable(fight({ ...boss, curve: flat, health: [], players: 4 })), []);
  assert.equal(untouchable(fight({ ...boss, curve: flat, health: [9, 8, 7, 7, 7, 7, 7, 6], players: 4 })).length, 1);
  assert.deepEqual(untouchable(fight({ ...boss, curve: flat, health: [9, 8, 7, 7, 7, 7, 7, 6], players: 1 })), []);
  assert.equal(activeDps(fight({ ...boss, rows: [you, still], health: [], you: { ...you, damage: 40 } })), 10);
  assert.equal(activeDps(fight({ ...boss, rows: [you], health: [], you: { ...you, damage: 40 } })), 5);
});

test("a skill with a cooldown that lay ready is found", () => {
  const [w] = waited(fight({ casts: [0, 10_000, 20_000, 30_000, 55_000].map((t) => hit(t, 7)) }));
  assert.deepEqual([w.skill, w.casts, w.usual, w.more], [7, 5, 10_000, 1]);
  assert.deepEqual(waited(fight({ casts: steady(60_000, 1_000) })), []);
});

test("a follow-up that stayed out is found", () => {
  const list = Array.from({ length: 8 }, (_, i) => [hit(i * 6_000, 1), ...(i === 4 ? [] : [hit(i * 6_000 + 1_000, 2)]), hit(i * 6_000 + 5_500, 3 + i)]).flat();
  assert.deepEqual(chains(fight({ casts: list })).map((c) => [c.first, c.next, c.kept, c.broke]), [[1, 2, 7, [24_000]]]);
});

test("a buff of yours that came without a cast is a proc", () => {
  const buff = (id: number, skill: number, by = 1) => ({ id, name: `B${id}`, on: 1, by, skill, passive: false, up: 5, spans: [[0, 10, 1], [10, 20, 2], [90, 99, 1]] as [number, number, number][] });
  assert.deepEqual(procs(fight({ casts: [hit(0, 50)], buffs: [buff(1, 50), buff(2, 60), buff(3, 61, 9)] })), [{ id: 2, name: "B2", times: 2, up: 5 }]);
  assert.equal(starts({ spans: [] }), 0);
});

test("parts of a fight add up to the whole", () => {
  const f = fight({ curve: [10, 20, 30, 40, 50], ms: 5_000, maxHp: 100, health: [90, 70, 50, 30, 10], killed: false });
  const all = parts(f, [80, 40]);
  // Health is 70% at the end of second 2, so 80% was passed by then.
  assert.deepEqual(all.map((p) => [p.name, p.from, p.to]), [["100% to 80%", 0, 2_000], ["80% to 40%", 2_000, 4_000], ["from 40%", 4_000, 5_000]]);
  assert.equal(all.reduce((s, p) => s + p.damage, 0), 50);
  // Passed in the first second.
  assert.deepEqual(parts(f, [95]).map((p) => [p.from, p.to]), [[0, 1_000], [1_000, 5_000]]);
  assert.deepEqual(parts(f, []), []);
  assert.deepEqual(parts(fight({ maxHp: 0 }), [50]), []);
});

test("a wipe in a line, with no name where none is known", () => {
  const deaths = [{ id: 4, you: false, ms: 30_000, up: -1, hits: [hit(29_900, 9, 1_500, 0)] }];
  const f = fight({ dummy: false, killed: false, maxHp: 200, health: [200, 50], deaths, names: { 9: "Breath" }, rows: [base.you!] });
  assert.equal(wipeLine(f, () => "Maren"), "25.0% left. Maren died first at 0:30, to Breath for 1.50K.");
  assert.equal(wipeLine({ ...f, killed: true }, () => ""), undefined);
  // A kept fight has your deaths alone: no first.
  const kept = { ...f, rows: undefined, deaths: [{ ...deaths[0], you: true }] };
  assert.equal(wipeLine(kept, () => ""), "25.0% left. You died at 0:30, to Breath for 1.50K.");
  assert.equal(left({ ...f, killed: true }), undefined);
  assert.equal(down(f).length, 0);
});

test("a report names what is worse than your best, and an old fight has nothing to say", () => {
  const good = demoSaved("a", { ms: 150_000, seed: 6, killed: true });
  const bad = demoSaved("b", { ms: 150_000, seed: 3, skill: 0.6 });
  const texts = findings(bad, good, [102]).map((f) => f.text).join(" ");
  for (const part of [/You were down/, /Nothing done/, /marked as avoidable/, /Swift Contract was on/]) assert.match(texts, part);
  assert.deepEqual(findings(fight({ you: null })), []);
  const old = { ...good, casts: undefined, taken: undefined, blows: undefined, buffs: undefined, deaths: undefined, health: undefined, rows: undefined, names: undefined };
  assert.deepEqual(findings(old, good), []);
});

test("small things", () => {
  assert.equal(opener({ curve: base.curve, ms: 10_000 }), undefined);
  assert.equal(opener(base), base.curve![19]);
  assert.equal(rhythm(base).length, 61);
  assert.match(resultText(base), /^Training dummy, 1:00\n/);
  assert.ok(!resultText(demoSaved("y", { ms: 150_000 })).includes("Maren"));
});

test("two runs alike but for luck have no real gain", () => {
  const run = (crits: number, gain = 1) =>
    fight({ casts: Array.from({ length: 100 }, (_, i) => hit(i * 600, 1, Math.round((i < crits ? 200 : 100) * gain) + (i % 3), i < crits ? 1 : 0)) });
  const lucky = luck(run(40), run(60))!;
  assert.ok(lucky.luck > 0.1 && Math.abs(lucky.real) < 0.02 && !lucky.sure, JSON.stringify(lucky));
  const better = luck(run(40), run(40, 1.1))!;
  assert.ok(Math.abs(better.luck) < 0.02 && better.real > 0.08 && better.sure, JSON.stringify(better));
  assert.equal(luck(fight({}), run(40)), undefined);
});

test("figures leave out what neither fight has", () => {
  const old = fight({ casts: undefined });
  assert.ok(!figures(old, old).some((f) => f.name === "Crit"));
  assert.deepEqual(statChanges(fight({ stats: { 1: 5, 2: 7 } }), fight({ stats: { 1: 6, 2: 7 } })), [{ id: "1", name: "Stat 1", a: 5, b: 6 }]);
  assert.deepEqual(statChanges(fight({ stats: {} }), fight({ stats: { 1: 6 } })), []);
  assert.ok(skillGains(base, demoSaved("z", { ms: 60_000, dummy: true, seed: 4 })).length > 3);
});
