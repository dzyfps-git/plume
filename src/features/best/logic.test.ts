import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSaved } from "../../live/demo.ts";
import type { Saved } from "../../live/types.ts";
import { runs } from "../history/logic.ts";
import { apart, beside, bestKill, bestRun, burst, burstText, fastest, grades, grow, records, runTime, shareAt, splits, streak, streaks, timeAt, trail, wipes } from "./logic.ts";

const fight = (id: string, more: Partial<Saved> & { dps?: number; deaths?: number } = {}): Saved => {
  const { dps = 1, deaths = 0, ...rest } = more;
  return {
    id, target: "Warden", code: 7, start: 1, ms: 60_000, total: 0, maxHp: 100, killed: true, dummy: false, dungeon: 0, others: 0, players: 1,
    you: { id: 1, job: "assassin", dps, deaths } as Saved["you"], ...rest,
  };
};

test("a grade is how many of your others it beat, and needs three", () => {
  const four = [fight("a", { dps: 1 }), fight("b", { dps: 2 }), fight("c", { dps: 3 }), fight("d", { dps: 4 })];
  const all = grades(four);
  assert.deepEqual(["a", "b", "c", "d"].map((id) => [all.get(id)!.score, all.get(id)!.tone]), [[0, "grey"], [33, "green"], [66, "blue"], [100, "gold"]]);
  assert.equal(grades(four.slice(1)).size, 0);
  // A lost pull, a short one and another class have none and count for none.
  const more = grades([...four, fight("e", { dps: 9, killed: false }), fight("f", { dps: 9, ms: 5_000 }), fight("g", { you: { job: "cleric", dps: 9 } as Saved["you"] })]);
  assert.deepEqual([more.size, more.get("d")!.score], [4, 100]);
  // Two as good as each other are no new best.
  assert.equal(grades([...four, fight("h", { dps: 4 })]).get("d")!.score, 87);
});

test("the best kill is the fastest of the same boss with the same health", () => {
  const all = [fight("a", { ms: 50_000 }), fight("b", { ms: 40_000 }), fight("c", { ms: 20_000, maxHp: 40 }), fight("d", { ms: 19_000, killed: false, left: 30 }), fight("e", { killed: false, left: -1 })];
  assert.equal(bestKill(all, { code: 7, name: "", maxHp: 101 })?.id, "b");
  assert.equal(bestKill(all, { code: 8, name: "Warden", maxHp: 100 }), undefined);
  assert.deepEqual(wipes(all, { code: 7, name: "", maxHp: 100 }), [0.3]);
});

test("a kill can be asked how much was left when, and when so much was left", () => {
  const points = trail({ ms: 4_500, maxHp: 100, health: [-1, 80, 50, 50, 10] });
  assert.deepEqual(points.map((p) => p.ms), [0, 2_000, 3_000, 4_000, 4_500]);
  assert.deepEqual([shareAt(points, 0), shareAt(points, 2_500), shareAt(points, 4_500), shareAt(points, 9_000)], [1, 0.65, 0, 0]);
  assert.deepEqual([timeAt(points, 1), timeAt(points, 0.65), timeAt(points, 0.5), timeAt(points, 0)], [0, 2_500, 3_000, 4_500]);
  assert.deepEqual([trail({ ms: 5_000, maxHp: 100, health: [] }), shareAt([], 1), timeAt([], 1)], [[], undefined, undefined]);
  assert.deepEqual([apart(12_400), apart(-67_000), apart(-200)], ["+0:12", "-1:07", "+0:00"]);
});

test("a run is split by its kills and held against the best one", () => {
  const run = (n: number, first: number, second: number, lost = false) => [
    fight(`${n}a`, { run: n, dungeon: 5, start: n, ms: first }),
    ...(lost ? [] : [fight(`${n}b`, { run: n, dungeon: 5, start: n + first, ms: second, code: 8, target: "Lord" })]),
  ];
  const all = runs([...run(1_000_000, 100_000, 50_000), ...run(2_000_000, 80_000, 90_000), ...run(3_000_000, 20_000, 0, true)]);
  const best = bestRun(all, 5)!;
  assert.equal(best.run, 1_000_000);
  assert.equal(bestRun(all, 5, 1_000_000)!.run, 2_000_000);
  assert.equal(bestRun(all, 6), undefined);
  const now = splits(run(9, 90_000, 0, true));
  assert.deepEqual(beside(now, splits(best.fights)), [
    { key: "7 1", name: "Warden", at: 90_000, best: 100_000 },
    { key: "8 1", name: "Lord", best: 150_000 },
  ]);
  // The same boss twice is two splits.
  assert.deepEqual(splits([fight("x"), fight("y", { start: 100_000 })]).map((s) => s.key), ["7 1", "7 2"]);
});

test("how long a run takes needs three, and counts from going in", () => {
  const list = [1, 2, 3, 4].map((n) => fight(`r${n}`, { run: n * 1e7, dungeon: 5, start: n * 1e7 + 60_000, ms: n * 100_000 }));
  assert.equal(runTime(runs(list)), 360_000);
  assert.equal(runTime(runs(list.slice(0, 2))), undefined);
});

test("bursts are timed by others' buffs and stagger breaks", () => {
  const curve = Array.from({ length: 60 }, (_, s) => (s + 1) * 10 + (s >= 20 ? Math.min(10, s - 19) * 90 : 0));
  const buff = { id: 1, name: "", on: 1, by: 2, skill: 0, passive: false, up: 5_000, spans: [[20_000, 25_000, 1]] as [number, number, number][] };
  const base = fight("a", { curve, buffs: [buff], stagger: [{ start: 0, end: 25_000, broke: true, max: 1, by: {} }] });
  const b = burst(base)!;
  assert.ok(b.share > 0.6 && b.buffed! > 0.4 && b.buffed! < 0.55 && b.broken! > 0.4, JSON.stringify(b));
  assert.match(burstText(b), /^Bursts: \d+% of your damage, \d+% of it under someone else's buff, \d+% of it in the 10 s after a stagger break\.$/);
  assert.equal(burst(fight("b", { curve })), undefined, "nothing to time it by");
  assert.equal(burst(fight("c", { curve, buffs: [{ ...buff, by: 1 }] })), undefined, "your own buff is no timing");
  assert.ok(burst(demoSaved("d", { ms: 120_000, killed: true })) === undefined || burst(demoSaved("d", { ms: 120_000, killed: true }))!.share <= 1);
});

test("records are by skill, on no dummy", () => {
  const big = (...all: [number, string, number][]) => ({ you: { big: all } as unknown as Saved["you"] });
  const list = records([fight("a", big([1, "Cut", 50], [2, "", 70])), fight("b", big([11, "Cut", 90])), fight("c", { dummy: true, ...big([1, "Cut", 999]) })]);
  assert.deepEqual(list.map((r) => [r.name || r.skill, r.amount, r.id]), [["Cut", 90, "b"], [2, 70, "a"]]);
  assert.deepEqual(fastest([fight("a"), fight("b", { ms: 30_000 }), fight("c", { killed: false, ms: 20_000 })]).map((f) => [f.kill.id, f.kills]), [["b", 2]]);
});

test("streaks are counted from the newest", () => {
  assert.deepEqual(streak([true, true, false, true, true, true]), { now: 2, most: 3 });
  assert.deepEqual([streak([]), streak([true])], [{ now: 0, most: 0 }, { now: 1, most: 1 }]);
  const s = streaks([fight("a"), fight("b", { deaths: 1 }), fight("c", { killed: false }), fight("d", { dummy: true, killed: false }), fight("e", { killed: false, ms: 4_000 })]);
  assert.deepEqual(s, { kills: { now: 2, most: 2 }, alive: { now: 1, most: 1 } });
});

test("a live curve grows by the second and starts again with the fight", () => {
  let curve = grow([], 2_400, 300);
  assert.deepEqual(curve, [100, 200, 300]);
  curve = grow(curve, 2_900, 330);
  curve = grow(curve, 4_100, 430);
  assert.deepEqual(curve, [100, 200, 330, 380, 430]);
  assert.deepEqual(grow(curve, 300, 20), [20]);
});
