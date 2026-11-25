import assert from "node:assert/strict";
import { test } from "node:test";
import { byRegion, counted, droppers, dropsOf, far, fromPicture, guess, height, inside, itemsLike, keyOf, nearest, onPicture, pack, regionAt, teleportNear, tick, unpack, type Drops, type WorldMap } from "./logic.ts";

const square = (x: number, y: number, size: number) => [x, y, x + size, y, x + size, y + size, x, y + size];
const map: WorldMap = {
  id: 1110, name: "Altgard", side: "asmodian", bounds: [-2000, -2000, 2000, 2000],
  regions: [{ name: "Wide", shape: square(-1000, -1000, 2000) }, { name: "Small", shape: square(0, 0, 100) }],
  zones: ["Zone"], labels: [],
  things: [
    { id: "trace", layer: "trace", name: "Empyrean Trace", spots: [10, 10, 50, 1, 0, 500, 500, 0, 0, 0, 3000, 0, 0, -1, -1] },
    { id: "cube", layer: "cube", name: "Hidden Cube", spots: [0, 0, 0, -1, -1] },
    { id: "teleport:1", layer: "teleport", name: "Safe Haven", spots: [-900, -900, 0, 0, 0] },
    { id: "teleport:2", layer: "teleport", name: "Camp", spots: [400, 400, 0, 0, 0] },
  ],
};

test("a spot packs into one number and back", () => {
  for (const [x, y] of [[0, 0], [-8192, 8191], [1269, -1028]]) assert.deepEqual(unpack(pack(x, y)), { x, y });
});

test("regions, the smallest first, and the picture both ways", () => {
  assert.ok(inside(50, 50, square(0, 0, 100)) && !inside(150, 50, square(0, 0, 100)));
  assert.equal(regionAt(map, 50, 50), 1);
  assert.equal(regionAt(map, -500, 50), 0);
  assert.equal(regionAt(map, 1500, 0), -1);
  assert.deepEqual(onPicture(map, 0, -2000, 2048), { x: 1024, y: 0 });
  assert.deepEqual(fromPicture(map, 1024, 2048, 2048), { x: 0, y: 2000 });
});

test("found ones drop out, the rest come nearest first, and counts follow", () => {
  const key = keyOf(1110, map.things[0]);
  const found = tick({}, key, { x: 10, y: 10 });
  assert.deepEqual(found, { [key]: [pack(10, 10)] });
  assert.deepEqual(tick(found, key, { x: 10, y: 10 }), {});
  const you = { x: 2900, y: 0, z: 0 };
  const near = nearest(map, [map.things[0]], found, you);
  assert.deepEqual(near.map((n) => [n.spot.x, Math.round(n.away)]), [[3000, 100], [500, 2452]]);
  assert.deepEqual(nearest(map, [map.things[0]], {}, null).map((n) => n.spot.x), [10, 500, 3000]);
  assert.equal(nearest(map, [map.things[0]], {}, { x: 10, y: 10, z: 0 })[0].up, 50);
  assert.equal(nearest(map, [map.things[1]], {}, { x: 10, y: 10, z: 300 })[0].up, 0, "a cube's height is not known");
  assert.deepEqual(counted(map, "trace", found), { all: 3, done: 1 });
  assert.deepEqual(byRegion(map, "trace", found), [{ name: "Small", all: 1, done: 1 }, { name: "Wide", all: 1, done: 0 }, { name: "", all: 1, done: 0 }]);
  assert.deepEqual(teleportNear(map, { x: 300, y: 300 }), { name: "Camp", away: Math.hypot(100, 100) });
});

test("a guess goes on as you went, for a while, and never through a teleport", () => {
  const at = (x: number, ms: number, map = 1110) => ({ map, known: true, x, y: 0, z: 0, at: ms });
  assert.deepEqual(guess(at(0, 0), at(10, 1000), 2000), { x: 20, y: 0, z: 0, guess: true });
  assert.equal(guess(at(0, 0), at(10, 1000), 60_000).x, 40, "three seconds at most");
  assert.deepEqual(guess(at(0, 0), at(900, 1000), 2000), { x: 900, y: 0, z: 0, guess: false });
  assert.equal(guess(at(0, 0, 20), at(10, 1000), 2000).guess, false);
  assert.equal(guess(null, at(10, 1000), 2000).guess, false);
});

test("what drops, from what, and how likely", () => {
  const d: Drops = {
    items: { 1: [3, "Wisdom Greatsword"], 2: [0, "Soul: Papis"] },
    lists: [[1, 31_011, 2, 100_000_000], [1, 81_871]],
    mobs: { 7: { name: "Rafflesia", lists: [0, 1] }, 8: { name: "Papis", lists: [1] } },
  };
  assert.deepEqual(dropsOf(d, 7).map((x) => [x.name, x.chance]), [["Soul: Papis", 100], ["Wisdom Greatsword", 0.081871]]);
  assert.deepEqual(droppers(d, 2).map((x) => [x.name, x.chance]), [["Rafflesia", 100]]);
  assert.deepEqual(itemsLike(d, "great wis").map((x) => x.item), [1]);
  assert.deepEqual(itemsLike(d, "a"), []);
  assert.deepEqual([far(950), far(1250), height(4), height(-30)], ["950 m", "1.3 km", "", "30 m down"]);
});
