import assert from "node:assert/strict";
import { test } from "node:test";
import { runOver } from "./logic.ts";

test("a run ends when you stop, and not before you start", () => {
  assert.deepEqual([runOver(0, 99_000), runOver(50_000, 55_000), runOver(50_000, 56_000)], [false, false, true]);
});
