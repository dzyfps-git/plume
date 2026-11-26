import assert from "node:assert/strict";
import { test } from "node:test";
import type { Kept } from "../characters/logic.ts";
import { checklist, isReward, total } from "./checklist.ts";

const at = Date.UTC(2026, 10, 25, 6);
const kept = (name: string, more: Partial<Kept> = {}): Kept => ({ name, job: "", at, odyle: [-1, 0], counts: [], duty: [-1, -1], points: [-1, -1], kinah: -1, map: 0, ...more });

test("each character is a column, and a row nobody has is left out", () => {
  const rows = checklist([kept("A", { kinah: 100, counts: [[4, 14, 0]] }), kept("B", { kinah: 50 })], [], false, at, () => "");
  const kinah = rows.find((r) => r.key === "kinah")!;
  assert.deepEqual(kinah.cells.map((c) => c?.n), [100, 50]);
  assert.equal(total(kinah), 150);
  const nightmare = rows.find((r) => r.key === "nightmare")!;
  assert.equal(nightmare.name, "Nightmare");
  assert.equal(nightmare.cells[1], undefined);
  assert.equal(nightmare.cells[0]!.lost, true, "14 of 14 is full");
  assert.equal(rows.some((r) => r.key === "odyle"), false);
});

test("a task is done once every character that has it is done", () => {
  const rows = checklist([kept("A", { duty: [5, 5], crafts: [[32_070_002, 4]] }), kept("B", { duty: [2, 5], crafts: [[32_070_002, 4]] })], [], false, at, () => "");
  assert.equal(rows.find((r) => r.key === "duty")!.done, false);
  assert.equal(rows.find((r) => r.key === "craft:32070002")!.done, true);
});

test("unnamed numbers are dungeon rewards or entries, and take the name you give", () => {
  assert.equal(isReward(60_000_001), false, "Odyle Energy");
  assert.equal(isReward(60_000_002), true);
  const rows = checklist([kept("A", { counts: [[60_000_002, 1, 0], [7, 3, 0], [3, 2, 0]] })], [{ id: 7, name: "Mine", kind: "", show: false }], false, at, () => "");
  assert.deepEqual(rows.map((r) => [r.group, r.name]), [["corridors", "Lower Abyss"], ["entries", "Mine"], ["dungeons", "Reward counter 60000002"]]);
});
