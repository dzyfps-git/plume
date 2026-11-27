import assert from "node:assert/strict";
import { test } from "node:test";
import { demoNear } from "../live/demo.ts";
import { NO_NEAR } from "../live/types.ts";
import { WHEN, type Layout, type When } from "../store/settings.ts";
import { activity, allowed, inFight, pick } from "./rules.ts";

const open = (near: typeof NO_NEAR) => WHEN.filter((when: When) => allowed({ when, job: "" }, near));

test("each rule holds when its word is true", () => {
  assert.deepEqual(open(NO_NEAR), ["always", "calm"]);
  const near = { ...demoNear(0, 0), fighting: true, foe: null, dungeon: 0 };
  assert.deepEqual(open(near), ["always", "fight", "boss"]);
  assert.deepEqual(open({ ...near, target: null, dungeon: 600_091, foe: near.you }), ["always", "fight", "dungeon", "pvp"]);
});

test("a class keeps others out, once yours is known", () => {
  const near = demoNear(0, 0);
  assert.ok(allowed({ when: "always", job: "assassin" }, near));
  assert.ok(!allowed({ when: "always", job: "cleric" }, near));
  assert.ok(allowed({ when: "always", job: "cleric" }, NO_NEAR));
});

test("a fight for the overlays, by the game, your hits or the party's, and some seconds after", () => {
  assert.equal(inFight("game", true, 0, 100, 0), true);
  assert.equal(inFight("game", false, 90_000, 100_000, 0), false);
  assert.equal(inFight("game", false, 90_000, 100_000, 15), true, "ten seconds after, of fifteen");
  assert.equal(inFight("you", false, 97_000, 100_000, 0), true, "a hit three seconds ago");
  assert.equal(inFight("party", false, 90_000, 100_000, 0), false);
});

test("the layout that fits: character and activity, then character, then activity", () => {
  const near = demoNear(0, 0);
  assert.equal(activity({ foe: null, party: near.party }, false), "force");
  assert.equal(activity({ foe: null, party: near.party.slice(0, 2) }, false), "party");
  assert.equal(activity({ foe: null, party: [] }, true), "dummy");
  assert.equal(activity({ foe: near.you, party: [] }, true), "pvp");
  const l = (name: string, when: Layout["when"], who: string): Layout => ({ name, when, who, places: {} });
  const all = [l("hand", "", ""), l("solo", "solo", ""), l("mine", "", "Dzy"), l("mine solo", "solo", "Dzy")];
  assert.equal(pick(all, "solo", "Dzy")?.name, "mine solo");
  assert.equal(pick(all, "party", "Dzy")?.name, "mine");
  assert.equal(pick(all, "solo", "Fa")?.name, "solo");
  assert.equal(pick(all, "party", "Fa"), undefined);
});
