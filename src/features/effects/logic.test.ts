import assert from "node:assert/strict";
import { test } from "node:test";
import { demoAura, demoNear } from "../../live/demo.ts";
import { ANY_ITEM, buffs, debuffs, held, hue, initials, missing, remaining, same } from "./logic.ts";

test("letters and a hue to know an effect by", () => {
  assert.deepEqual(["Word of Wind", "venom", "Swift Contract", "", "Earth's Grip II"].map(initials), ["WW", "Ve", "SC", "", "EI"]);
  assert.equal(hue("Venom"), hue("Venom"));
  assert.ok(hue("Venom") >= 0 && hue("") < 360);
});

test("what is left, in few letters", () => {
  assert.deepEqual([65_900, 42_100, 4_240, 0].map(remaining), ["1:05", "43", "4.2", "0.0"]);
});

test("buffs that run out, soonest first, and no passives", () => {
  const list = [demoAura(1, "Long", { end: 90 }), demoAura(2, "Passive"), demoAura(3, "Short", { end: 10 }), demoAura(4, "Soup", { item: true }), demoAura(5, "Venom", { bad: true, end: 5 })];
  assert.deepEqual(buffs(list).map((a) => a.name), ["Short", "Long", "Soup"]);
  assert.deepEqual(debuffs(list).map((a) => a.name), ["Venom"]);
});

test("the longest of what holds you", () => {
  const list = [demoAura(1, "A", { tag: "stun", end: 10 }), demoAura(2, "B", { tag: "fear", end: 30 }), demoAura(3, "C", { tag: "slow", end: 90 })];
  assert.equal(held(list)?.name, "B");
  assert.equal(held([list[2]]), undefined);
});

test("ready means chosen effects are on, and only out of fights", () => {
  const near = { ...demoNear(0, 0), fighting: false };
  near.you = { ...near.you!, auras: [demoAura(9, "Swift Contract"), demoAura(4, "Soup", { item: true })] };
  const chosen = [{ id: 1, name: "Swift Contract" }, { id: 2, name: "Shield" }, ANY_ITEM];
  assert.deepEqual(missing(chosen, near).map((m) => m.name), ["Shield"]);
  assert.deepEqual(missing(chosen, { ...near, fighting: true }), []);
  assert.deepEqual(missing(chosen, { ...near, you: null }), []);
  assert.ok(same({ id: 1, name: "X" }, { id: 2, name: "X" }) && !same({ id: 1, name: "" }, { id: 2, name: "" }));
});
