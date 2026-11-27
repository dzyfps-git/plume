import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_FIGHT } from "../../live/types.ts";
import { hp, timeLeft } from "./logic.ts";

const fight = (hp: number, maxHp: number, total: number, ms: number) => ({ target: { ...NO_FIGHT.target, hp, maxHp }, total, ms });

test("a reading wins over what was dealt, and neither leaves the bar", () => {
  assert.equal(hp(fight(40, 100, 90, 0)), 40);
  assert.equal(hp(fight(-1, 100, 30, 0)), 70);
  assert.equal(hp(fight(-1, 100, 300, 0)), 0);
  assert.equal(hp(fight(500, 100, 0, 0)), 100);
});

test("time left follows the pace", () => {
  assert.equal(timeLeft(fight(50, 100, 50, 10_000)), 10_000);
  assert.equal(timeLeft(fight(50, 100, 50, 4_999)), undefined);
  assert.equal(timeLeft(fight(0, 100, 100, 10_000)), undefined);
  assert.equal(timeLeft(fight(99, 100, 0, 10_000)), undefined);
  assert.equal(timeLeft(fight(1e12, 1e12, 1, 10_000)), undefined);
});
