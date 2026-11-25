import assert from "node:assert/strict";
import { test } from "node:test";
import { share, who } from "./logic.ts";

test("health is a share, or nothing", () => {
  assert.deepEqual([share({ hp: 30, maxHp: 120 }), share({ hp: -1, maxHp: 9 }), share({ hp: 5, maxHp: 0 }), share({ hp: 9, maxHp: 6 })], [0.25, undefined, undefined, 1]);
});

test("names can be hidden, but not yours", () => {
  assert.deepEqual([who({ name: "Maren", you: false }, 1, true), who({ name: "", you: false }, 2, false), who({ name: "Me", you: true }, 0, true)], ["Player 2", "Player 3", "Me"]);
});
