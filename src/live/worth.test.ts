import assert from "node:assert/strict";
import { test } from "node:test";
import { demoFight } from "./demo.ts";
import { NO_FIGHT } from "./types.ts";
import { limit, worth } from "./worth.ts";

test("which fights are shown", () => {
  const boss = demoFight(9_000);
  const trash = { ...boss, target: { ...boss.target, boss: false } };
  const dummy = { ...trash, target: { ...trash.target, dummy: true } };
  const inside = { ...boss, dungeon: 600_091 };
  const all = [boss, trash, dummy, inside, NO_FIGHT];
  assert.deepEqual(all.map((f) => worth(f, "")), [true, true, true, true, true]);
  assert.deepEqual(all.map((f) => worth(f, "boss")), [true, false, true, true, true]);
  assert.deepEqual(all.map((f) => worth(f, "dungeon")), [false, false, true, true, false]);
});

test("a boss gets more time than the rest, and one that fell less", () => {
  const set = { end: 30, bossEnd: 45 };
  assert.deepEqual([limit({ boss: false, hp: 5, maxHp: 9 }, set), limit({ boss: true, hp: 5, maxHp: 9 }, set), limit({ boss: true, hp: 0, maxHp: 9 }, set)], [30_000, 45_000, 5_000]);
});
