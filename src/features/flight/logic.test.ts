import assert from "node:assert/strict";
import { test } from "node:test";
import { air } from "./logic.ts";

const f = { now: 50, max: 100, back: 5, out: 10, flying: true, at: 1_000 };

test("flying empties it, and landing fills it", () => {
  assert.deepEqual(air(f, 2_000), { now: 40, share: 0.4, ms: 4_000, flying: true });
  assert.deepEqual(air({ ...f, flying: false }, 2_000), { now: 55, share: 0.55, ms: 9_000, flying: false });
});

test("it never leaves its ends, and what is not known is not said", () => {
  assert.deepEqual(air(f, 99_000), { now: 0, share: 0, ms: 0, flying: true });
  assert.deepEqual(air({ ...f, flying: false }, 99_000), { now: 100, share: 1, ms: undefined, flying: false });
  assert.deepEqual(air({ ...f, max: 0, out: 0 }, 1_000), { now: 50, share: undefined, ms: undefined, flying: true });
});
