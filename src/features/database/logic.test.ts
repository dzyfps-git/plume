import assert from "node:assert/strict";
import { test } from "node:test";
import { index, search, usedIn } from "./logic.ts";

const all = index({
  items: { grades: [], items: { 11: ["Iron Ore", 0, ""], 12: ["Iron Sword", 1, ""], 13: ["Old Iron", 0, ""] } },
  names: { made: "", skills: { 100: "Iron Will", 101: "Iron Will" }, effects: {}, monsters: { 7: ["Iron Golem", 1], 8: ["Iron Golem", 1] } },
  dungeons: { 5: ["Iron Fort", "Conquest"], 6: ["Iron Fort", "Exploration"] },
});

test("each thing once by kind and name, with all its numbers", () => {
  assert.deepEqual(all.find((e) => e.kind === "skill")?.ids, [100, 101]);
  assert.deepEqual(all.find((e) => e.kind === "monster"), { kind: "monster", name: "Iron Golem", ids: [7, 8], grade: undefined, more: "Boss" });
  assert.equal(all.filter((e) => e.kind === "dungeon").length, 2, "modes stay apart");
});

test("the best matches first, by kind, and a number finds its thing", () => {
  assert.deepEqual(search(all, "iron", "item").map((e) => e.name), ["Iron Ore", "Iron Sword", "Old Iron"]);
  assert.deepEqual(search(all, "ore", "").map((e) => e.name), ["Iron Ore"]);
  assert.deepEqual(search(all, "101", "").map((e) => e.name), ["Iron Will"]);
  assert.deepEqual(search(all, "  ", ""), []);
  assert.deepEqual(usedIn({ made: "", recipes: { 12: { of: [["11", 3]] } } }, 11), [12]);
});
