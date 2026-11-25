import assert from "node:assert/strict";
import { test } from "node:test";
import { demoNear } from "../live/demo.ts";
import { NO_NEAR } from "../live/types.ts";
import { WHEN, type When } from "../store/settings.ts";
import { allowed } from "./rules.ts";

const open = (near: typeof NO_NEAR) => WHEN.filter((when: When) => allowed({ when, job: "" }, near));

test("each rule holds when its word is true", () => {
  assert.deepEqual(open(NO_NEAR), ["always", "calm"]);
  const near = { ...demoNear(0, 0), fighting: true, foe: null, dungeon: 0 };
  assert.deepEqual(open(near), ["always", "fight", "boss"]);
  assert.deepEqual(open({ ...near, target: null, dungeon: 600_091, foe: near.you }), ["always", "fight", "dungeon", "pvp"]);
});

test("a class keeps others out, once yours is known", () => {
  const near = demoNear(0, 0);
  assert.ok(allowed({ when: "always", job: "assassin" }, near));
  assert.ok(!allowed({ when: "always", job: "cleric" }, near));
  assert.ok(allowed({ when: "always", job: "cleric" }, NO_NEAR));
});
