import assert from "node:assert/strict";
import { test } from "node:test";
import type { Saved } from "../../live/types.ts";
import { bestOf, bests, byDay, filtered, pace, path } from "./logic.ts";

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
