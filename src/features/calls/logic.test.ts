import assert from "node:assert/strict";
import { test } from "node:test";
import type { Aura } from "../../live/types.ts";
import { heard, onBoss, words, type CallFile } from "./logic.ts";

const file: CallFile = {
  safe: "Safe to attack",
  watch: "Watch the boss",
  bosses: { thamon: { name: "Thamon", group: "Vakron Sky Island" } },
  calls: [
    { key: "thamon-red", t: "cast", id: 1604660, boss: "thamon", line: "Burn! Burn!!", short: "Stop physical", say: "Physical classes stop attacking", lead: 1790, phase: { a: 16046601, ms: 10_000, say: "Stop physical" } },
    { key: "use:7:thamon", t: "use", id: 7, boss: "thamon", line: "", short: "", say: "" },
    { key: "abnormal:9:thamon", t: "abnormal", id: 9, boss: "thamon", line: "Feel my wrath!", short: "", say: "" },
  ],
};
const aura = (key: string, id: number, end: number) => ({ key, id, end, name: "", skill: 0, bad: false, tag: "", item: false, by: 0, yours: false, foe: false, stacks: 1, start: 0 }) as Aura;

test("what is said, and what turned off is not", () => {
  const [red] = heard(file, "cast", 1604660, []);
  assert.equal(words(red, "say", file), "Physical classes stop attacking");
  assert.equal(words(red, "line", file), "Burn! Burn!!");
  assert.equal(words(heard(file, "use", 7, [])[0], "say", file), "Watch the boss");
  assert.deepEqual(heard(file, "cast", 1604660, ["thamon"]), []);
  assert.deepEqual(heard(file, "cast", 1604660, ["thamon-red"]), []);
  assert.deepEqual(heard(file, "use", 1604660, []), []);
});

test("a phase on the boss is counted down, and safe follows when it ends", () => {
  const first = onBoss(file, [aura("a", 16046601, 20_000), aura("b", 9, 0)], new Map(), [], 10_000);
  assert.deepEqual(first.shown.map((s) => [s.call.key, s.end, s.phase]), [["thamon-red", 20_000, true], ["abnormal:9:thamon", 0, false]]);
  assert.equal(first.safe, false);
  const again = onBoss(file, [aura("a", 16046601, 20_000)], first.seen, [], 11_000);
  assert.deepEqual([again.shown, again.safe], [[], false], "seen already");
  const over = onBoss(file, [], again.seen, [], 20_100);
  assert.equal(over.safe, true);
  assert.equal(onBoss(file, [], over.seen, [], 21_000).safe, false, "once");
});

test("turning a boss off during its phase says nothing, and no false safe", () => {
  const first = onBoss(file, [aura("a", 16046601, 20_000)], new Map(), [], 10_000);
  // Turned off while the phase is still on the boss.
  const off = onBoss(file, [aura("a", 16046601, 20_000)], first.seen, ["thamon"], 11_000);
  assert.deepEqual([off.shown, off.safe], [[], false], "the phase is still there");
  const over = onBoss(file, [], off.seen, ["thamon"], 20_100);
  assert.equal(over.safe, false, "nothing is said for a boss that is off");
});
