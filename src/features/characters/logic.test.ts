import assert from "node:assert/strict";
import { test } from "node:test";
import { carried, energy, fullIn, lines, order, type Kept } from "./logic.ts";

const H = 3_600_000;
// Wednesday 25 November 2026, 06:00 UTC: an hour before the daily and the weekly reset.
const at = Date.UTC(2026, 10, 25, 6);
const kept = (name: string, daily: number, counts: Kept["counts"] = []): Kept => ({ name, job: "", at, odyle: [daily, 0], counts, duty: [-1, -1], points: [-1, -1], kinah: -1, map: 0 });

test("what comes back is carried on, in whole steps and no further than the most", () => {
  assert.equal(carried("odyle", 500, at, at + 7 * H, false), 530);
  assert.equal(carried("odyle", 550, at, at + 7 * H, false), 560);
  assert.equal(carried("shugo", 4, at, at + 2 * H, false), 7, "one daily reset");
  assert.equal(carried("exploration", 2, at, at + 2 * H, false), 7, "the weekly reset brings 7");
  assert.equal(carried("shugo", 4, at, at + 30 * 60_000, false), 4);
  // Seen a moment ahead of the page's clock: no step is taken off.
  assert.equal(carried("odyle", 0, at, at - 20_000, false), 0);
});

test("Odyle Energy full in, and what goes to waste first", () => {
  assert.equal(fullIn(560, false, undefined, at), 0);
  assert.equal(fullIn(545, false, undefined, at), 3 * H, "the longest, when its hour is not known");
  assert.equal(fullIn(530, false, { most: 545, gains: [[15, at - H]] }, at), 2 * H + 3 * H);
  assert.equal(energy(kept("a", 559), true, at).most, 840);
  // 545 seen 2 h 59 m ago: full in a minute, not in three hours.
  assert.equal(energy(kept("a", 545), false, at + 3 * H - 60_000).full, 60_000);
  // A name of your own, with no kind and no known most, still shows.
  assert.deepEqual(lines(kept("a", 0, [[9, 3, 0]]), [{ id: 9, name: "Rift", kind: "", show: false }], false, at), [{ name: "Rift", value: 3, most: 0, lost: false }]);
  const shugo = [{ id: 1, name: "", kind: "shugo" as const, show: false }];
  assert.deepEqual(lines(kept("a", 0, [[1, 12, 0], [9, 3, 0]]), shugo, false, at), [{ name: "Shugo Festival keys", value: 12, most: 12, lost: true }]);
  assert.deepEqual(order([kept("b", 100), kept("a", 545), kept("c", 545, [[1, 12, 0]])], shugo, false, at).map((k) => k.name), ["c", "a", "b"]);
});
