import assert from "node:assert/strict";
import { test } from "node:test";
import { counts, done, fits, sources, toGo, type Pet } from "./logic.ts";

const pet = (over: Partial<Pet> = {}): Pet => ({ id: 1066, name: "Papis", kind: "fera", where: [], ...over });

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
  assert.deepEqual(sources(pet({ how: "Souls: possible reward from Pet Soul Chest: Fera (Bound). Pet unlock: check Black Cloud Merchants for the pet item; shop stock varies." })), ["chest", "market"]);
  assert.deepEqual(sources(pet({ how: "In-game Menu > Shop > Atelier > Weapons/Wings/Pets" })), ["shop"]);
  assert.deepEqual(sources(pet()), ["other"]);
});

test("several kinds and places at once: any of each, both together", () => {
  const w = (map: number) => ({ npc: 1, name: "", level: 1, map, at: "", zones: [], spots: 1 });
  const elyosFera = pet({ where: [w(1010)] });
  const abyssCogni = pet({ kind: "cogni", where: [w(20)] });
  const none = new Set<never>();
  assert.ok(fits(elyosFera, none, none), "nothing chosen is all");
  assert.ok(fits(elyosFera, new Set(["fera", "cogni"]), none));
  assert.ok(!fits(elyosFera, new Set(["cogni"]), none));
  assert.ok(fits(abyssCogni, new Set(["cogni"]), new Set(["elyos", "abyss"])));
  assert.ok(!fits(abyssCogni, new Set(["fera"]), new Set(["abyss"])), "kind and place both count");
});
