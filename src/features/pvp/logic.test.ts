import assert from "node:assert/strict";
import { test } from "node:test";
import { count, hold, NONE, resume, type Tally } from "./logic.ts";

const run = (...all: [Parameters<typeof count>[1]["what"], number, number?][]) =>
  all.reduce<Tally>((t, [what, at, amount = 0]) => count(t, { what, at, amount }), NONE);

test("streaks end with you, and the best stays", () => {
  const t = run(["kill", 1], ["kill", 2], ["death", 3], ["kill", 4], ["assist", 5]);
  assert.deepEqual([t.kills, t.assists, t.deaths, t.streak, t.best], [3, 1, 1, 1, 2]);
});

test("points near a kill are that kill's", () => {
  const t = run(["kill", 1_000], ["points", 1_500, 120], ["points", 60_000, 30]);
  assert.deepEqual([t.points, t.last], [150, 120]);
  assert.equal(count(t, { what: "blow", at: 0, amount: 0 }), t);
});

test("a count goes on after a short break, and nothing broken is taken", () => {
  const tally = run(["kill", 1], ["points", 2, 9]);
  assert.deepEqual(resume(JSON.parse(JSON.stringify({ at: 1_000, tally })), 2_000), tally);
  for (const bad of [null, 3, "x", {}, { at: 1_000 }, { at: 1_000, tally: { kills: 1 } }, { at: 9_000, tally }, { at: 1_000, tally: { ...tally, kills: "1" } }]) {
    assert.equal(resume(bad, 2_000), NONE);
  }
  assert.equal(resume({ at: 1_000, tally }, 1_000 + 6 * 3_600_000), NONE);
});

test("a control effect counts once, and only another player's", () => {
  const seen = new Map<string, number>();
  const stun = { key: "1:9", tag: "stun", foe: true, start: 1_000, end: 3_500 };
  let t = hold(NONE, [stun, { ...stun, key: "2", foe: false }, { ...stun, key: "3", tag: "slow" }], seen);
  t = hold(t, [stun], seen);
  assert.deepEqual([t.held, t.heldMs], [1, 2_500]);
  assert.equal(hold(t, [{ ...stun, start: 9_000, end: 9_500 }], seen).held, 2);
});
