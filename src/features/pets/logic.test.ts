import assert from "node:assert/strict";
import { test } from "node:test";
import { counts, done, hear, sources, toGo, type Pet } from "./logic.ts";

const pet = (over: Partial<Pet> = {}): Pet => ({ id: 1066, name: "Papis", kind: "fera", where: [], ...over });

test("all replaces, souls add and level by themselves, a level takes its cost once", () => {
  const all = hear({ levels: { 9: 2 }, souls: { 9: 4 } }, { what: "all", levels: [[1066, 1], [1004, 0]], souls: [[1066, 24], [1004, 3]] });
  assert.deepEqual(all, { levels: { 1066: 1 }, souls: { 1066: 24, 1004: 3 } });
  const up = hear(all, { what: "souls", levels: [], souls: [[1066, 3], [1004, 2]] });
  assert.deepEqual(up, { levels: { 1066: 2, 1004: 1 }, souls: { 1066: 2 } });
  // Said again after the souls did it: nothing more is taken.
  assert.deepEqual(hear(up, { what: "level", levels: [[1066, 2]], souls: [] }), up);
  const by = hear({ levels: {}, souls: { 7: 30 } }, { what: "level", levels: [[7, 2]], souls: [] });
  assert.deepEqual(by, { levels: { 7: 2 }, souls: {} });
  const top = hear({ levels: { 7: 3 }, souls: {} }, { what: "souls", levels: [], souls: [[7, 9]] });
  assert.deepEqual(top, { levels: { 7: 3 }, souls: { 7: 9 } }, "souls past the last level stay");
});

test("souls to go, done and how many have each level", () => {
  assert.equal(toGo(pet(), 0, 0, 3), 105);
  assert.equal(toGo(pet(), 1, 10, 2), 15);
  assert.equal(toGo(pet(), 2, 0, 1), 0);
  assert.equal(toGo(pet({ kind: "special" }), 0, 0, 3), 0);
  assert.ok(Math.abs(done(pet(), 1, 0, 3) - 5 / 105) < 1e-9);
  assert.equal(done(pet({ kind: "special" }), 3, 0, 3), 1);
  assert.deepEqual(counts([pet(), pet({ id: 2 }), pet({ id: 3 })], { 1066: 3, 2: 1 }), [2, 1, 1]);
});

test("where souls come from", () => {
  const w = (map: number) => ({ npc: 1, name: "", level: 1, map, at: "", zones: [], spots: 1 });
  assert.deepEqual(sources(pet({ where: [w(1110), w(600021), w(23)] })), ["asmodian", "abyss", "dungeon"]);
  assert.deepEqual(sources(pet({ how: "check Black Cloud Merchants for the pet item" })), ["market"]);
  assert.deepEqual(sources(pet()), ["other"]);
});
