import assert from "node:assert/strict";
import { test } from "node:test";
import { heard, rows, type SkinFile } from "./logic.ts";

const file: SkinFile = {
  made: "",
  skins: {
    1: ["Plain Hood", "", 0, "Helmet", 20, ["Black Cloud Merchant"]],
    2: ["Dragon Blade", "", 3, "Greatsword", 10, ["Fire Temple Conquest Hard"]],
    3: ["Wind Cape", "Gale Cape", 1, "Cape", 30, ["Hidden Cube"]],
  },
};

test("the Closet at login takes the place of what was kept, and each skin added joins it", () => {
  const all = heard({ ids: [9], told: 0 }, { what: "all", ids: [1, 1, 2] }, 50);
  assert.deepEqual(all, { ids: [1, 2], told: 50 });
  assert.deepEqual(heard(all, { what: "added", ids: [3] }, 60), { ids: [1, 2, 3], told: 50 });
  assert.equal(heard(all, { what: "added", ids: [2] }, 60), all, "nothing new is the same");
});

test("skins as chosen, in the game's order, searched by name or by where they come from", () => {
  const owned = new Set([1]);
  assert.deepEqual(rows(file, owned, "all", "", "").map((r) => r.id), [2, 1, 3]);
  assert.deepEqual(rows(file, owned, "missing", "", "").map((r) => r.id), [2, 3]);
  assert.deepEqual(rows(file, owned, "have", "", "").map((r) => r.id), [1]);
  assert.deepEqual(rows(file, owned, "all", "Cape", "").map((r) => r.id), [3]);
  assert.deepEqual(rows(file, owned, "all", "", "gale").map((r) => r.id), [3]);
  assert.deepEqual(rows(file, owned, "all", "", "fire temple").map((r) => r.id), [2]);
});
