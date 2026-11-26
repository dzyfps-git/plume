import assert from "node:assert/strict";
import { test } from "node:test";
import { canTake, letGo, statWords, sums, type Board } from "./logic.ts";

// The middle is 113 (row 7, column 7). A line to the right of it, 114 to 116, and 98 above.
const board: Board = { id: 41, nodes: [[113, "None", ""], [114, "Common", "Attack"], [115, "Common", "Attack"], [116, "Legend", 13340000], [98, "Rare", "MaxHP"], [120, "Common", "Defense"]] };

test("a node is taken next to the middle or to one taken, never across the edge or far off", () => {
  assert.equal(canTake(board, [], 114), true);
  assert.equal(canTake(board, [], 98), true, "above the middle");
  assert.equal(canTake(board, [], 115), false);
  assert.equal(canTake(board, [114], 115), true);
  assert.equal(canTake(board, [114], 114), false, "taken already");
  assert.equal(canTake(board, [], 113), false, "the middle is always taken");
  assert.equal(canTake(board, [114, 115, 116], 120), false);
  assert.equal(canTake(board, [], 112), false, "not a node");
});

test("letting one go lets go of what hung on it", () => {
  assert.deepEqual(letGo(board, [114, 115, 116, 98], 114), [98]);
  assert.deepEqual(letGo(board, [114, 115, 116], 116), [114, 115]);
});

test("what a build gives, and stats in words", () => {
  assert.deepEqual(sums([board], { name: "", job: "Assassin", taken: { 41: [114, 115, 116, 98] } }), { stats: [["Attack", 2], ["MaxHP", 1]], skills: [13340000] });
  assert.equal(statWords("CriticalHitResist"), "Critical hit resist");
  assert.equal(statWords("PvEAttack"), "PvE attack");
  assert.equal(statWords("MaxHP"), "Max HP");
  assert.equal(statWords("IncreasesMaxHP"), "Increases max HP");
});
