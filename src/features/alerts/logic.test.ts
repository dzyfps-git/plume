import assert from "node:assert/strict";
import { test } from "node:test";
import { demoAura, demoNear } from "../../live/demo.ts";
import type { Near } from "../../live/types.ts";
import { DEFAULTS, plan } from "../../store/settings.ts";
import { ahead, bossEffects, look, notes, onBlow, onEffects, raised, safe, streakText } from "./logic.ts";

const base = (): Near => {
  const n = demoNear(0, 0);
  n.fighting = false;
  n.you = { ...n.you!, hp: 90, maxHp: 100, auras: [] };
  n.party = n.party.slice(0, 3).map((u) => ({ ...u, hp: 90, maxHp: 100, auras: [] }));
  n.target = { ...n.target!, auras: [] };
  return n;
};
const between = (from: Near, to: Near) => {
  const before = look(from, DEFAULTS.alerts);
  return raised(before, look(to, DEFAULTS.alerts, before), to, false).map((r) => `${r.id} ${r.text}`);
};

test("each alert comes as it begins, and not again while it lasts", () => {
  const [a, b] = [base(), base()];
  b.fighting = true;
  b.you = { ...b.you!, hp: 20, auras: [demoAura(1, "Stun", { tag: "stun" })] };
  b.party[1] = { ...b.party[1], hp: 10 };
  b.target = { ...b.target!, auras: [demoAura(2, "Rage", { tag: "enrage" })] };
  assert.deepEqual(between(a, b), ["low Low health", `ally ${b.party[1].name} is low`, "fight Fight", "held Stunned", "enrage Enraged"]);
  assert.deepEqual(between(b, b), []);
});

test("health that hovers at the mark alerts once", () => {
  const [a, b, c] = [base(), base(), base()];
  b.you = { ...b.you!, hp: 29 };
  c.you = { ...c.you!, hp: 33 };
  const one = look(a, DEFAULTS.alerts);
  const two = look(b, DEFAULTS.alerts, one);
  const three = look(c, DEFAULTS.alerts, two);
  assert.ok(two.low && three.low);
});

test("a death is told once, and only of someone who was alive", () => {
  const [a, b] = [base(), base()];
  b.party[2] = { ...b.party[2], hp: 0 };
  assert.deepEqual(between(a, b), [`died ${b.party[2].name} died`]);
  assert.deepEqual(between(b, b), []);
  const unknown = base();
  unknown.party[2] = { ...unknown.party[2], hp: -1 };
  assert.deepEqual(between(unknown, b), []);
});

const set = plan({
  notes: "Stack at the pillar.",
  timers: [{ skill: 101, name: "Stomp", at: [20] }],
  mechanics: [
    { id: 101, name: "Stomp", note: "jump", say: true },
    { id: 102, name: "Breath", note: "hide", job: "cleric" },
    { id: 7, name: "Storm", effect: true },
  ],
});

test("a mechanic is called on its hit, on its effect, and ahead of its time", () => {
  assert.deepEqual(onBlow(set, { skill: 101, name: "" }, "assassin"), [{ text: "Stomp: jump", say: true }]);
  assert.deepEqual(onBlow(set, { skill: 102, name: "Breath" }, "assassin"), []);
  assert.equal(onBlow(set, { skill: 102, name: "Breath" }, "cleric").length, 1);
  const storm = demoAura(7, "Storm");
  assert.deepEqual(onEffects(set, [storm], new Set(), "").map((c) => c.text), ["Storm"]);
  assert.deepEqual(onEffects(set, [storm], new Set([storm.key]), ""), []);
  assert.deepEqual(ahead(set, 14_900, 15_100, 5, "").map((c) => c.text), ["In 5: Stomp: jump"]);
  assert.deepEqual(ahead(set, 15_100, 15_300, 5, ""), []);
});

test("notes show at the start of a boss fight", () => {
  const fight = { ms: 1_000, rows: [{}], target: { boss: true } } as never;
  assert.equal(notes(set, fight, true), "Stack at the pillar.");
  assert.equal(notes(set, fight, false), "");
  assert.equal(notes(set, { ms: 30_000, rows: [{}], target: { boss: true } } as never, true), "");
});

test("the rest", () => {
  assert.equal(safe([demoAura(1, "A"), demoAura(2, "B", { tag: "safe", end: 9 })])?.name, "B");
  assert.deepEqual([streakText(1), streakText(4)], ["Kill", "4 in a row"]);
  const pull = { you: { id: 1 }, rows: [{ id: 1 }, { id: 2 }], buffs: [{ id: 7, name: "Storm", on: 900, by: 900, passive: false }, { id: 8, name: "Mine", on: 900, by: 1, passive: false }, { id: 9, name: "Own", on: 2, by: 2, passive: false }] };
  assert.deepEqual(bossEffects([pull]), [{ id: 7, name: "Storm" }]);
});
