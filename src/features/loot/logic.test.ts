import assert from "node:assert/strict";
import { test } from "node:test";
import type { LootEvent } from "../../live/types.ts";
import { anHour, count, dayOf, emptyDay, kinahGained, kinahSaid, rates, redact, rolled } from "./logic.ts";

const place = { map: 0, dungeon: 0, content: 0, contentState: 0 };
// 25 November 2026, 08:00 UTC: the day began at 07:00.
const t = Date.UTC(2026, 10, 25, 8);
const items = (at: number, list: [number, number, "new" | "changed" | "removed", number | null][]): LootEvent => ({ at, atPlace: place, kind: "items", items: list.map(([item, total, change, gained]) => ({ item, total, change, gained })) });

test("a day counts what was gained, gathered, dropped for you and killed", () => {
  const start = dayOf(t);
  assert.equal(start, Date.UTC(2026, 10, 25, 7));
  let d = emptyDay(start);
  d = count(d, items(t, [[100000001, 5, "new", null], [100000002, 90, "changed", null], [100000003, 0, "removed", null]]));
  d = count(d, items(t + 60_000, [[100000002, 92, "changed", 2]]));
  d = count(d, { at: t + 120_000, atPlace: place, kind: "gather", gather: { type: "done", node: 1, status: 1, item: 100000004, count: 1, bonus: 2, extraItem: 100000005, extraCount: 1 } });
  d = count(d, { at: t + 130_000, atPlace: place, kind: "kill", entity: 9, mob: 2920661, byYou: true, byParty: false });
  d = count(d, { at: t + 131_000, atPlace: place, kind: "drops", drops: [{ source: 9, mob: 2920661, item: 100000006, count: 1, owner: "you" }, { source: 9, mob: 2920661, item: 100000007, count: 1, owner: "other" }] });
  d = count(d, { at: t + 20 * 60_000, atPlace: place, kind: "kill", entity: 10, mob: 2920661, byYou: true, byParty: false });
  assert.deepEqual(d.gained, { 100000001: 5, 100000002: 2 });
  assert.deepEqual(d.gathered, { 100000004: 3, 100000005: 1 });
  assert.deepEqual(d.dropped, { 2920661: { 100000006: 1 } });
  assert.deepEqual(d.kills, { 2920661: 2 });
  assert.equal(d.active, 131_000, "the long gap is time away");
  assert.deepEqual(rates([d]), [{ mob: 2920661, item: 100000006, drops: 1, kills: 2 }]);
  assert.equal(count(d, items(t + 24 * 3_600_000, [[1, 1, "new", null]])), d, "another day's");
  assert.equal(anHour(10, 30 * 60_000), 20);
  const k = kinahSaid(kinahSaid(kinahSaid(d, -1), 1000), 4500);
  assert.equal(kinahGained(k), 3500);
});

test("a Dice Roll is put together from what was said", () => {
  let all = rolled([], { at: 1, roll: { type: "open", rollId: "a", itemId: 7, count: 1, endsAt: 35_001 } });
  all = rolled(all, { at: 2, roll: { type: "roll", itemId: 7, player: { serverId: 1, name: "Vel" }, roll: 900 } });
  all = rolled(all, { at: 3, roll: { type: "mine", rollId: "a", roll: 4000 } });
  all = rolled(all, { at: 4, roll: { type: "pass", rollId: "a", itemId: 7, player: { serverId: 1, name: "Pell" } } });
  all = rolled(all, { at: 5, roll: { type: "won", rollId: "a", itemId: 7, player: { serverId: 1, name: "Me" } } });
  assert.equal(all.length, 1);
  assert.deepEqual(all[0].rolls, [{ name: "", roll: 4000, you: true }, { name: "Vel", roll: 900, you: false }]);
  assert.deepEqual([all[0].passed, all[0].winner, all[0].ends], [["Pell"], "Me", 35_001]);
});

test("a kill that gave a stack counts once, and a relaunch gains only what grew", () => {
  let d = emptyDay(dayOf(t));
  d = count(d, { at: t, atPlace: place, kind: "kill", entity: 9, mob: 5, byYou: true, byParty: false });
  d = count(d, { at: t + 1, atPlace: place, kind: "drops", drops: [{ source: 9, mob: 5, item: 8, count: 3, owner: "you" }] });
  assert.deepEqual(rates([d]), [{ mob: 5, item: 8, drops: 1, kills: 1 }], "one kill in one, not 300%");
  // 100 then 200 seen, then Plume starts again and first hears 1,200: 100 was gained, not 1,100.
  const seen = kinahSaid(kinahSaid(d, 100, true), 200);
  const again = kinahSaid(seen, 1200, true);
  assert.equal(kinahGained(again), 100);
  assert.equal(kinahGained(kinahSaid(again, 1500)), 400);
  // Another character, poorer than what was gained: the gain stays.
  const other = kinahSaid(kinahSaid(kinahSaid(d, 0, true), 50), 10, true);
  assert.equal(kinahGained(other), 50);
  assert.equal(kinahGained(kinahSaid(other, 30)), 70);
});

test("a roll past its end takes no later result, and names are not kept", () => {
  let all = rolled([], { at: 1, roll: { type: "open", rollId: "a", itemId: 7, count: 1, endsAt: 100 } });
  all = rolled(all, { at: 500, roll: { type: "roll", itemId: 7, player: { serverId: 1, name: "Vel" }, roll: 900 } });
  assert.equal(all.length, 2, "a new roll, not the closed one");
  assert.deepEqual(all.find((r) => r.id === "a")!.rolls, []);
  const kept = redact({ id: "b", item: 7, count: 1, at: 1, ends: 0, rolls: [{ name: "Vel", roll: 9, you: false }, { name: "", roll: 5, you: true }], passed: ["Pell"], winner: "Vel" });
  assert.deepEqual([kept.rolls.map((x) => x.name), kept.passed, kept.winner], [["Player 1", ""], ["Player 2"], "Player 1"]);
});
