import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSaved } from "../../live/demo.ts";
import type { Entry, Saved } from "../../live/types.ts";
import { calls, hitBy, learn, pace, seconds, trend, upcoming } from "./logic.ts";

const pull = (ms: number, blows: Entry[]) => ({ ...demoSaved("x", { ms }), blows, names: { 1: "Stomp", 2: "Claw" } }) as Saved;

test("a big hit that comes at one time each pull becomes a timer", () => {
  const pulls = [0, 1_500, -1_000].map((late) =>
    pull(60_000, [[5_000, 2, 1, 100], [20_000 + late, 1, 2, 4_000], [11_000 + late * 9, 2, 1, 100], [50_000 + late, 1, 1, 2_000]]),
  );
  assert.deepEqual(learn(pulls), [{ skill: 1, name: "Stomp", at: [20, 50], damage: 2_000, pulls: 3 }]);
  assert.deepEqual(learn(pulls.slice(0, 1)), []);
  assert.deepEqual(learn([]), []);
});

test("a hit that came once, or at any time, is no timer", () => {
  assert.deepEqual(learn([5_000, 25_000, 45_000].map((at) => pull(60_000, [[at, 1, 1, 900]]))), []);
});

test("a pull too short to see it does not count against it", () => {
  const long = [1, 2].map(() => pull(60_000, [[50_000, 1, 1, 900]]));
  const short = [10_000, 12_000, 9_000].map((ms) => pull(ms, [[3_000, 2, 1, 10]]));
  assert.equal(learn([...long, ...short])[0].name, "Stomp");
});

test("what comes next, nearest first", () => {
  const timers = [{ skill: 1, name: "Stomp", at: [20, 50] }, { skill: 2, name: "Breath", at: [35] }];
  assert.deepEqual(upcoming(timers, 18_000).map((t) => [t.name, t.in]), [["Stomp", 2_000], ["Breath", 17_000]]);
  assert.deepEqual(upcoming(timers, 60_000), []);
});

test("marks, timers and the enrage are each said once", () => {
  const plan = { enrage: 100, marks: [80, 50], avoid: [], timers: [{ skill: 1, name: "Stomp", at: [20] }], mechanics: [], notes: "" };
  const said = (a: number, b: number, from = 1, to = 1) => calls(plan, { ms: a, share: from }, { ms: b, share: to }, 5);
  assert.deepEqual(said(14_900, 15_100), ["Stomp"]);
  assert.deepEqual(said(15_100, 15_300), []);
  assert.deepEqual(said(1_000, 1_250, 0.81, 0.79), ["80 percent"]);
  assert.deepEqual(said(69_900, 70_000), ["Enrage in 30"]);
  assert.deepEqual(said(90_000, 100, 0.2, 1), []);
});

test("times as they are typed", () => {
  assert.deepEqual(["1:30", "90", "2m", "1m30", "45s", "", "x", "1:2:3"].map(seconds), [90, 90, 120, 90, 45, undefined, undefined, undefined]);
});

test("the pace to beat the enrage", () => {
  assert.deepEqual([pace(30_000, 120), pace(30_000, 0), pace(300_000, 120)], [0.75, undefined, 0]);
});

test("what hit you, and whether it gets better", () => {
  const [a, b] = [pull(60_000, []), pull(60_000, [])];
  a.taken = [[1, 1, 50, 10]];
  b.taken = [[1, 1, 50, 10], [2, 1, 50, 10], [3, 2, 5, 10]];
  assert.deepEqual(hitBy([a, b]).map((h) => [h.name, h.hits, h.last, h.damage]), [["Stomp", 3, 1, 150], ["Claw", 1, 0, 5]]);
  assert.deepEqual(trend([a, b], [1]), [2, 1]);
});
