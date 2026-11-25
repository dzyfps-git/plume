import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_ENTRIES } from "../../live/types.ts";
import { nameOf, resets, runsLeft, strip, wait, words } from "./logic.ts";

const entries = { ...NO_ENTRIES, counts: [[1, 5, 1], [4, 0, 5], [7, 2, 0]] as [number, number, number][] };
const chosen = [{ id: 4, name: "Expedition", show: true }, { id: 7, name: "", show: true }, { id: 9, name: "Gone", show: true }, { id: 1, name: "", show: false }];

test("only what was chosen and is known shows", () => {
  const list = strip(entries, [0, 1455], chosen);
  assert.deepEqual(list.map((l) => [l.name, l.value, l.more]), [["Odyle", "0", "+1,455"], ["Expedition", "0", "+5"], ["No. 7", "2", ""]]);
  assert.deepEqual(words(list), ["Expedition 0 (+5)", "No. 7 2"]);
  assert.deepEqual(strip(NO_ENTRIES, [-1, -1], chosen), []);
  assert.equal(list[0].runs, 36);
});

test("energy is enough for so many runs", () => {
  // As the game's players count it: 1,455 left at 80 a run.
  assert.deepEqual([runsLeft([0, 1_455], 80), runsLeft([0, 1_455], 40), runsLeft([39, 0], 40), runsLeft([-1, -1], 40)], [18, 36, 0, 0]);
});

test("your own name goes before the known one", () => {
  assert.equal(nameOf(1, chosen), "Shugo Festival keys");
  assert.equal(nameOf(1, [{ id: 1, name: "Keys", show: true }]), "Keys");
  assert.equal(nameOf(8, chosen), "");
});

test("resets are at 07:00 UTC, the weekly one on Wednesday", () => {
  const tuesday = Date.UTC(2026, 10, 24, 6);
  assert.deepEqual(resets(tuesday), { daily: 3_600_000, weekly: 25 * 3_600_000 });
  assert.equal(resets(Date.UTC(2026, 10, 25, 7)).weekly, 7 * 86_400_000);
  assert.deepEqual([wait(3_600_000), wait(60_000), wait(27 * 3_600_000)], ["1 h 0 m", "1 m", "1 d 3 h"]);
});
