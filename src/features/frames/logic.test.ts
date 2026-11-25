import assert from "node:assert/strict";
import { test } from "node:test";
import { demoNear } from "../../live/demo.ts";
import { groups, ordered, share, who } from "./logic.ts";

test("health is a share, or nothing", () => {
  assert.deepEqual([share({ hp: 30, maxHp: 120 }), share({ hp: -1, maxHp: 9 }), share({ hp: 5, maxHp: 0 }), share({ hp: 9, maxHp: 6 })], [0.25, undefined, undefined, 1]);
});

test("names can be hidden, but not yours", () => {
  assert.deepEqual([who({ name: "Maren", you: false }, 1, true), who({ name: "", you: false }, 2, false), who({ name: "Me", you: true }, 0, true)], ["Player 2", "Player 3", "Me"]);
});

test("the party in the order you want it", () => {
  const { party } = demoNear(0, 0);
  const names = (order: "game" | "role" | "name", you = true) => ordered(party, { order, you }).map(({ unit }) => unit.name);
  assert.deepEqual(names("game"), party.map((u) => u.name));
  assert.deepEqual(names("role").slice(0, 4), ["Oskar", "Wren", "Ilse", "Pell"]);
  assert.deepEqual(names("name", false)[0], "Brisa");
  assert.equal(ordered(party, { order: "name", you: true }).find(({ unit }) => unit.name === "Maren")!.at, 1);
  assert.deepEqual(groups([1, 2, 3, 4, 5]), [[1, 2, 3, 4], [5]]);
  assert.equal(who({ name: "Me", you: true }, 0, "all"), "You");
});
