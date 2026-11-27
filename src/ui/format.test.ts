import assert from "node:assert/strict";
import { test } from "node:test";
import { clock, day, percent, short } from "./format.ts";

test("numbers keep three figures", () => {
  const cases: [number, string][] = [[0, "0"], [949.6, "950"], [1000, "1.00K"], [9999, "10.0K"], [32_410, "32.4K"], [999_900, "1.00M"], [1_976_181, "1.98M"], [123_456_789, "123M"], [2_100_000_000, "2.10B"]];
  for (const [n, text] of cases) assert.equal(short(n), text);
});

test("times", () => {
  assert.deepEqual([clock(-5), clock(7_900), clock(83_000), clock(3_725_000)], ["0:00", "0:07", "1:23", "1:02:05"]);
});

test("a share of nothing is nothing", () => {
  assert.deepEqual([percent(1, 0), percent(1, 3)], ["0%", "33%"]);
});

test("days", () => {
  const now = new Date(2026, 10, 24, 0, 30).getTime();
  assert.equal(day(now - 60_000 * 20, now), "Today");
  assert.equal(day(now - 60_000 * 40, now), "Yesterday");
});
