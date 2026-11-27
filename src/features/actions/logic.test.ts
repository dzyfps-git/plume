import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSaved } from "../../live/demo.ts";
import { cooling, learned } from "./logic.ts";

test("cooldowns come from your own fights, of your class", () => {
  const fights = [1, 2, 3].map((seed) => demoSaved(`f${seed}`, { ms: 150_000, seed }));
  const known = learned(fights, "assassin");
  const ambush = known.find((k) => k.name === "Ambush")!;
  assert.ok(Math.abs(ambush.back - 18_500) < 2_000, String(ambush.back));
  assert.ok(known.every((k, i) => i === 0 || known[i - 1].back >= k.back));
  assert.deepEqual(learned(fights, "cleric"), []);
  assert.equal(learned(fights, "").length, known.length);
});

test("a skill cools from its last cast", () => {
  assert.deepEqual(cooling({ back: 10 }, 100, 105), { start: 100, end: 110 });
  assert.equal(cooling({ back: 10 }, 100, 110), undefined);
  assert.equal(cooling({ back: 10 }, undefined, 110), undefined);
});

test("what the game says since the cast wins over what was learned", () => {
  assert.deepEqual(cooling({ back: 10 }, 100, 105, { end: 130, at: 101 }), { start: 100, end: 130 });
  assert.equal(cooling({ back: 10 }, 100, 105, { end: 101, at: 101 }), undefined, "said to be back");
  assert.deepEqual(cooling({ back: 10_000 }, 100_000, 105_000, { end: 999_000, at: 50_000 }), { start: 100_000, end: 110_000 }, "said before the cast");
  assert.deepEqual(cooling({ back: 10 }, undefined, 105, { end: 130, at: 101 }), { start: 101, end: 130 });
});
