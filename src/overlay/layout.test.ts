import assert from "node:assert/strict";
import { test } from "node:test";
import { hold, MARGIN, snap, toPixels, toShare } from "./layout.ts";

const own = { width: 300, height: 200 };
const screen = { width: 1920, height: 1080 };

test("a place keeps its meaning on another screen", () => {
  for (const s of [screen, { width: 2560, height: 1440 }, { width: 1280, height: 720 }]) {
    assert.deepEqual(toPixels({ x: 0, y: 0 }, own, s), { x: MARGIN, y: MARGIN });
    assert.deepEqual(toPixels({ x: 1, y: 1 }, own, s), { x: s.width - 300 - MARGIN, y: s.height - 200 - MARGIN });
  }
  const at = { x: 640, y: 333 };
  assert.deepEqual(toPixels(toShare(at, own, screen), own, screen), at);
});

test("an overlay bigger than the screen still shows its corner", () => {
  assert.deepEqual(toPixels({ x: 1, y: 1 }, { width: 5000, height: 5000 }, screen), { x: MARGIN, y: MARGIN });
  assert.deepEqual(toShare({ x: 50, y: 50 }, { width: 5000, height: 5000 }, screen), { x: 0, y: 0 });
});

test("edges, the middle and other overlays pull, and the rest lies on the grid", () => {
  assert.deepEqual(snap({ x: 5, y: 875 }, own, screen, []), { x: MARGIN, y: 868 });
  assert.equal(snap({ x: 806, y: 300 }, own, screen, []).x, 810);
  assert.deepEqual(snap({ x: 503, y: 301 }, own, screen, []), { x: 504, y: 304 });
  assert.equal(snap({ x: 500, y: 407 }, own, screen, [{ x: 500, y: 300, width: 300, height: 100 }]).y, 404);
});

test("nothing leaves the screen", () => {
  assert.deepEqual(snap({ x: -900, y: 9000 }, own, screen, []), { x: MARGIN, y: 868 });
});

test("a held edge stays put while the height changes", () => {
  const at = toShare({ x: 100, y: 400 }, own, screen);
  const grown = { width: 300, height: 320 };
  assert.deepEqual(hold(at, grown, screen, "top", 200), { x: 100, y: 400 });
  assert.deepEqual(hold(at, grown, screen, "bottom", 200), { x: 100, y: 280 });
  assert.deepEqual(hold({ x: 0, y: 1 }, grown, screen, "top", 200), { x: MARGIN, y: 1080 - MARGIN - 320 });
});
