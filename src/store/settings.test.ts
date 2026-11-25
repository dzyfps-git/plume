import assert from "node:assert/strict";
import { test } from "node:test";
import { barEase, DEFAULTS, place, read } from "./settings.ts";

test("nothing, and nonsense, give the defaults", () => {
  for (const v of [null, undefined, 3, "x", [], {}, { meter: 5, hotkeys: [], fps: 61, updateMs: "fast", mode: "?" }]) {
    assert.deepEqual(read(v), DEFAULTS);
  }
});

test("what is there is kept, inside its limits", () => {
  const s = read({ live: false, fps: 144, updateMs: 9, meter: { rows: 99, style: "line" }, hotkeys: { edit: "" }, overlay: { opacity: 0 } });
  assert.deepEqual([s.live, s.fps, s.updateMs, s.meter.rows, s.meter.style, s.hotkeys.edit, s.overlay.opacity], [false, 144, 50, 24, "line", "", 0.2]);
  assert.equal(s.hotkeys.overlay, DEFAULTS.hotkeys.overlay);
});

test("settings read twice are the same", () => {
  const once = read({ accent: "rose", places: { meter: { on: true, x: 0.5, y: 0.5, scale: 1 } } });
  assert.deepEqual(read(JSON.parse(JSON.stringify(once))), once);
});

test("a place stays on the screen", () => {
  const d = { on: true, x: 0.1, y: 0.2, scale: 1 };
  assert.deepEqual(place({ x: 7, y: Number.NaN, scale: 0 }, d), { on: true, x: 1, y: 0.2, scale: 0.6 });
});

test("bars move in as many steps as the frame rate gives", () => {
  assert.equal(barEase(60, 250), "steps(15, jump-end)");
  assert.equal(barEase(30, 50), "steps(2, jump-end)");
  assert.equal(barEase(0, 250), "linear");
});

test("a boss's plan keeps only what can be", () => {
  const { bosses } = read({ bosses: { 7: { enrage: -3, marks: [50, 50, 80, 0, "x"], avoid: [5], timers: [{ skill: 1, at: [4, -1] }, { skill: 2, at: [] }, 9] }, 8: 3 } });
  assert.deepEqual(bosses["7"], { enrage: 0, marks: [80, 50], avoid: [5], timers: [{ skill: 1, name: "", at: [4] }] });
  assert.deepEqual(bosses["8"], { enrage: 0, marks: [], avoid: [], timers: [] });
});
