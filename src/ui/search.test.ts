import assert from "node:assert/strict";
import { test } from "node:test";
import { matches } from "./search.ts";

test("a setting is found by any of its words", () => {
  assert.deepEqual([matches("Party frames Width", "width party"), matches("Party frames Width", "width force"), matches("Width", " ")], [true, false, true]);
});
