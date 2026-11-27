import assert from "node:assert/strict";
import { test } from "node:test";
import { demoAura, demoNear, demoSaved } from "../../live/demo.ts";
import type { AuraRule } from "../../store/settings.ts";
import { learned } from "../actions/logic.ts";
import { read } from "../../store/settings.ts";
import { blank, effectsOf, fresh, ruleName, SETS, starter, states } from "./logic.ts";

const near = demoNear(0, 0);
near.fighting = true;
near.you = { ...near.you!, hp: 20, maxHp: 100, auras: [demoAura(1, "Wind", { start: 0, end: 10_000, stacks: 2, yours: true })] };
near.target = { ...near.target!, auras: [demoAura(2, "Venom", { start: 0, end: 5_000, yours: true }), demoAura(3, "Other", { end: 9_000 })] };
near.party = [{ ...near.party[0], you: true }, { ...near.party[1], hp: 5, auras: [] }, { ...near.party[2], hp: 0, auras: [] }];
const skills = [{ skill: 7, name: "Ambush", back: 10_000, casts: 9 }];
const at = (now: number, edit: Partial<AuraRule>, casts = new Map<number, number>()) => states([blank("a", edit)], near, skills, casts, now);

test("an effect on you, with its time and its stacks", () => {
  const [s] = at(1_000, { of: { id: 1, name: "" } });
  assert.deepEqual([s.end, s.stacks, s.name], [10_000, 2, "Effect 1"]);
  assert.equal(at(1_000, { of: { id: 1, name: "" }, value: 5 }).length, 0);
  assert.equal(at(6_000, { of: { id: 1, name: "" }, value: 5 }).length, 1);
  assert.equal(at(10_000, { of: { id: 1, name: "" } }).length, 0);
});

test("what is missing, on you and on the target", () => {
  assert.equal(at(0, { kind: "missing", of: { id: 1, name: "" } }).length, 0);
  assert.equal(at(0, { kind: "missing", of: { id: 8, name: "Shield" } })[0].text, "missing");
  assert.equal(at(0, { kind: "target", of: { id: 2, name: "" } }).length, 1);
  // Someone else's is not yours.
  assert.equal(at(0, { kind: "target", of: { id: 3, name: "" } }).length, 0);
  assert.equal(at(0, { kind: "untarget", of: { id: 3, name: "" } }).length, 1);
});

test("a skill, ready or nearly", () => {
  const of = { id: 7, name: "Ambush" };
  assert.equal(at(0, { kind: "ready", of })[0].text, "ready");
  assert.equal(at(3_000, { kind: "ready", of }, new Map([[7, 0]])).length, 0);
  assert.equal(at(8_000, { kind: "ready", of, value: 3 }, new Map([[7, 0]]))[0].end, 10_000);
  assert.equal(at(0, { kind: "ready", of: { id: 8, name: "Unknown" } }).length, 0);
});

test("low health, and a buff that reaches only some of the living", () => {
  assert.equal(at(0, { kind: "low", value: 30 })[0].text, "20%");
  assert.equal(at(0, { kind: "low", value: 10 }).length, 0);
  assert.equal(at(0, { kind: "party", of: { id: 1, name: "Wind" } })[0].text, "1 of 2");
});

test("off, or only in fights, or with nobody there, shows nothing", () => {
  const of = { id: 1, name: "" };
  assert.equal(at(0, { of, on: false }).length, 0);
  assert.equal(states([blank("a", { of, fight: true })], { ...near, fighting: false }, [], new Map(), 0).length, 0);
  assert.equal(states([blank("a", { of, fight: false })], { ...near, you: null }, [], new Map(), 0).length, 0);
});

test("one comes on once", () => {
  const list = at(0, { of: { id: 1, name: "" } });
  assert.equal(fresh(new Set(), list).length, 1);
  assert.equal(fresh(new Set(["a"]), list).length, 0);
});

test("a set to start from comes from your own fights", () => {
  const fights = [1, 2].map((seed) => demoSaved(`f${seed}`, { ms: 150_000, seed, skill: 0.9 }));
  const set = starter(fights, learned(fights, ""), (n) => `s${n}`);
  assert.deepEqual(set.filter((a) => a.kind === "on").map((a) => a.of.name), ["Swift Contract", "Shadow Edge"]);
  assert.deepEqual(set.filter((a) => a.kind === "target").map((a) => a.of.name), ["Heart Gore"]);
  assert.ok(set.some((a) => a.kind === "ready" && a.of.name === "Ambush"));
  assert.equal(new Set(set.map((a) => a.key)).size, set.length);
  assert.ok(!effectsOf(fights).some((e) => e.name === "Nimble Body"));
});

test("a ready-made set is made of auras the settings keep as they are", () => {
  for (const set of Object.values(SETS)) {
    const rules = set.map((edit, n) => blank(`s${n}`, edit));
    assert.deepEqual(read({ auras: JSON.parse(JSON.stringify(rules)) }).auras, rules);
    assert.equal(new Set(rules.map((r) => `${r.kind} ${ruleName(r)}`)).size, rules.length);
    assert.ok(rules.every((r) => r.kind === "low" || (r.of.id && r.of.name)));
  }
});
