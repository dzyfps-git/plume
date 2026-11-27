import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_ENTRIES } from "../../live/types.ts";
import type { Resource } from "../../store/settings.ts";
import { coming, guess, kindOf, nameOf, note, resets, runsLeft, strip, wait, type Seen } from "./logic.ts";

const entries = { ...NO_ENTRIES, counts: [[1, 5, 1], [4, 0, 5], [7, 2, 0]] as [number, number, number][] };
const chosen = [
  { id: 4, name: "Mine", kind: "nightmare", show: true }, { id: 7, name: "", kind: "", show: true }, { id: 9, name: "Gone", kind: "", show: true }, { id: 1, name: "", kind: "", show: false },
] as Resource[];

test("only what was chosen and is known shows", () => {
  const list = strip(entries, [0, 1455], chosen);
  assert.deepEqual(list.map((l) => [l.name, l.value, l.more]), [["Odyle", "0", "+1,455"], ["Mine", "0", "+5"], ["No. 7", "2", ""]]);
  assert.deepEqual(list.map((l) => l.kind), ["odyle", "nightmare", ""]);
  assert.deepEqual(strip(NO_ENTRIES, [-1, -1], chosen), []);
  assert.equal(list[0].runs, 36);
});

test("energy is enough for so many runs", () => {
  // As the game's players count it: 1,455 left at 80 a run.
  assert.deepEqual([runsLeft([0, 1_455], 80), runsLeft([0, 1_455], 40), runsLeft([39, 0], 40), runsLeft([-1, -1], 40)], [18, 36, 0, 0]);
});

test("your own name goes before the known one", () => {
  assert.equal(nameOf(1, chosen), "Shugo Festival keys");
  assert.equal(nameOf(1, [{ id: 1, name: "Keys", kind: "", show: true }]), "Keys");
  assert.equal(nameOf(4, [{ id: 4, name: "", kind: "ascension", show: true }]), "Ascension Trial");
  assert.deepEqual([kindOf(1, []), kindOf(1, [{ id: 1, name: "", kind: "rift", show: true }]), kindOf(2, [])], ["shugo", "rift", ""]);
  assert.equal(nameOf(8, chosen), "Dimensional Invasion");
  assert.equal(nameOf(7, chosen), "");
});

test("resets are at 07:00 UTC, the weekly one on Wednesday", () => {
  const tuesday = Date.UTC(2026, 10, 24, 6);
  assert.deepEqual(resets(tuesday), { daily: 3_600_000, weekly: 25 * 3_600_000 });
  assert.equal(resets(Date.UTC(2026, 10, 25, 7)).weekly, 7 * 86_400_000);
  assert.deepEqual([wait(3_600_000), wait(60_000), wait(27 * 3_600_000)], ["1 h 0 m", "1 m", "1 d 3 h"]);
});

const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour, minute);

test("what comes back is known by the resets, or by when it last came", () => {
  assert.equal(coming("shugo", 5, false, undefined, at(24, 6))?.in, 3_600_000);
  assert.equal(coming("shugo", 12, false, undefined, at(24, 6)), undefined);
  assert.equal(coming("shugo", 12, true, undefined, at(24, 6))?.in, 3_600_000);
  assert.equal(coming("odyle", 300, false, undefined, at(24, 6)), undefined);
  const grown: Seen = { most: 315, gains: [[40, at(24, 1)], [15, at(24, 2)], [100, at(24, 3)]] };
  const next = coming("odyle", 315, false, grown, at(24, 6))!;
  assert.deepEqual([next.in, Math.round(next.part * 100)], [2 * 3_600_000, 33]);
  assert.equal(coming("rift", 1, false, undefined, 0), undefined);
});

test("an entry is guessed only when one kind fits", () => {
  const none = new Set<never>();
  const grew = (most: number, ...gains: [number, number][]): Seen => ({ most, gains });
  assert.equal(guess(grew(9, [3, at(24, 7, 1)]), none), "shugo");
  assert.equal(guess(grew(9, [2, at(24, 7, 1)]), none), "nightmare");
  assert.equal(guess(grew(6, [1, at(24, 15, 2)]), none), "conquest");
  assert.equal(guess(grew(6, [1, at(24, 19, 2)]), none), "transcendence");
  assert.equal(guess(grew(3, [3, at(25, 7, 1)]), new Set(["shugo", "ascension"] as const)), "subjugation");
  assert.deepEqual([guess(grew(3, [3, at(25, 7, 1)]), none), guess(grew(14), none), guess(undefined, none), guess(grew(5), none)], ["", "", "", ""]);
  assert.equal(guess(grew(21), new Set(["shugo"] as const)), "conquest");
});

test("a drop is no gain", () => {
  let s = note(undefined, undefined, 5, 1);
  s = note(s, 5, 4, 2);
  s = note(s, 4, 7, 3);
  assert.deepEqual(s, { most: 7, gains: [[3, 3]] });
});
