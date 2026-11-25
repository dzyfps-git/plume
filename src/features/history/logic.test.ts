import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSaved } from "../../live/demo.ts";
import type { Saved } from "../../live/types.ts";
import { alike, bestOf, bests, byDay, characters, filtered, pace, path, rdps, runs, session, tick, tries } from "./logic.ts";

const fight = (id: string, more: Partial<Saved> & { dps?: number } = {}): Saved => ({
  id, target: "Warden", code: 7, start: 1, ms: 60_000, total: 0, maxHp: 0, killed: false, dummy: false, dungeon: 0, others: 0, players: 1,
  ...more,
  you: more.you === null ? null : ({ dps: more.dps ?? 1 } as Saved["you"]),
});

test("filters and search", () => {
  const all = [fight("a"), fight("b", { killed: true, target: "Lord" }), fight("c", { dummy: true })];
  const ids = (f: Saved[]) => f.map(({ id }) => id).join("");
  assert.equal(ids(filtered(all, "all", "")), "abc");
  assert.equal(ids(filtered(all, "bosses", "")), "ab");
  assert.equal(ids(filtered(all, "kills", "")), "b");
  assert.equal(ids(filtered(all, "dummies", "")), "c");
  assert.equal(ids(filtered(all, "all", " lord ")), "b");
});

test("the best is by target, and short or foreign fights do not count", () => {
  const all = [fight("a", { dps: 5 }), fight("b", { dps: 9 }), fight("c", { dps: 99, ms: 9_000 }), fight("d", { you: null }), fight("e", { dps: 1, code: 8 })];
  const best = bests(all);
  assert.equal(bestOf(best, all[0])?.id, "b");
  assert.equal(bestOf(best, all[4])?.id, "e");
});

test("dummies are held against runs of the same length", () => {
  const [short, long] = [fight("s", { dummy: true, ms: 30_000, dps: 9 }), fight("l", { dummy: true, ms: 120_000, dps: 5 })];
  assert.equal(bestOf(bests([short, long]), long)?.id, "l");
});

test("one class is not held against another", () => {
  const as = (id: string, job: string, dps: number) => ({ ...fight(id), you: { name: id, job, dps } as Saved["you"] });
  const all = [as("a", "assassin", 5), as("b", "cleric", 9)];
  assert.equal(bestOf(bests(all), all[0])?.id, "a");
  assert.deepEqual(alike(all, all[0]), []);
});

test("characters are told apart by name, the last played first", () => {
  const as = (name: string, job: string) => ({ ...fight(name), you: { name, job } as Saved["you"] });
  assert.deepEqual(characters([as("Nyx", ""), as("Vel", "cleric"), as("Nyx", "assassin"), as("", "ranger"), fight("x", { you: null })]), [
    { name: "Nyx", job: "assassin", fights: 2 }, { name: "Vel", job: "cleric", fights: 1 },
  ]);
});

test("two fights are ticked at most", () => {
  assert.deepEqual(["a", "b", "c", "b"].reduce<string[]>(tick, []), ["c"]);
  assert.deepEqual(["a", "b", "c"].reduce<string[]>(tick, []), ["b", "c"]);
});

test("days keep their order", () => {
  assert.deepEqual(byDay([{ start: 3 }, { start: 3 }, { start: 1 }], String).map(([d, f]) => [d, f.length]), [["3", 2], ["1", 1]]);
});

test("a steady curve has a steady pace", () => {
  const curve = Array.from({ length: 12 }, (_, i) => (i + 1) * 100);
  assert.ok(pace(curve).every((v) => v === 100), String(pace(curve)));
  assert.deepEqual(pace([]), []);
});

test("a line fits its box", () => {
  assert.equal(path([0, 10], 100, 50, 10, 2), "M0.0 50.0L100.0 0.0");
  assert.equal(path([1], 100, 50, 10, 2), "");
});

test("a session ends at a long break", () => {
  const at = (id: string, start: number) => demoSaved(id, { ms: 60_000, start });
  const hour = 3_600_000;
  const list = [at("c", 20 * hour), at("b", 19 * hour), at("a", 15 * hour)];
  assert.deepEqual(session(list).map((f) => f.id), ["c", "b"]);
  assert.deepEqual(session([]), []);
});

test("tries on a boss are counted together", () => {
  const lost = { ...demoSaved("a", { ms: 100_000 }), left: 30, maxHp: 100 };
  const [t, d] = tries([lost, { ...lost, left: 12 }, demoSaved("b", { ms: 90_000, killed: true }), demoSaved("d", { ms: 60_000, dummy: true })]);
  assert.deepEqual([t.tries, t.kills, t.closest, t.deaths], [3, 1, 0.12, 2]);
  assert.deepEqual([d.tries, d.closest], [1, undefined]);
});

test("a dungeon run is its fights in order", () => {
  const list = [
    demoSaved("b", { ms: 60_000, start: 500_000, run: 9, killed: true }), demoSaved("a", { ms: 60_000, start: 100_000, run: 9 }),
    demoSaved("x", { ms: 60_000, start: 50_000 }), demoSaved("o", { ms: 60_000, start: 10_000, run: 5 }),
  ];
  const all = runs(list);
  assert.deepEqual(all.map((r) => r.fights.map((f) => f.id)), [["a", "b"], ["o"]]);
  assert.deepEqual([all[0].ms, all[0].fought, all[0].kills], [460_000, 120_000, 1]);
  assert.deepEqual(filtered(list, "runs", "").length, 3);
});

test("rDPS is your own, with buffs counted", () => {
  const you = { damage: 1_000, got: 100, given: 300 };
  assert.equal(rdps({ ms: 10_000, you: you as never }), 120);
  assert.equal(rdps({ ms: 10_000, you: { damage: 5 } as never }), undefined);
  assert.equal(rdps({ ms: 10_000, you: null }), undefined);
});

test("only fights of one kind are compared", () => {
  const [a, b, c] = [demoSaved("a", { ms: 60_000 }), demoSaved("b", { ms: 90_000 }), demoSaved("c", { ms: 60_000, dummy: true })];
  assert.deepEqual(alike([a, b, c], a).map((f) => f.id), ["b"]);
});
