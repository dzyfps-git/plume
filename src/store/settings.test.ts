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

test("where the second screen was is four numbers or nothing", () => {
  assert.deepEqual(read({ second: { at: [1920, -20, 900, 700], parts: ["boss", "?"], size: 9 } }).second, { ...DEFAULTS.second, at: [1920, -20, 900, 700], parts: ["boss"], size: 2 });
  for (const at of [[1, 2, 3], [0, 0, 0, 5], "x"]) assert.equal(read({ second: { at } }).second.at, undefined);
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
  assert.deepEqual(bosses["7"], { enrage: 0, marks: [80, 50], avoid: [5], timers: [{ skill: 1, name: "", at: [4] }], mechanics: [], notes: "" });
  assert.deepEqual(bosses["8"], { enrage: 0, marks: [], avoid: [], timers: [], mechanics: [], notes: "" });
});

test("auras, rules, alerts and the rest keep only what can be", () => {
  const s = read({
    auras: [{ kind: "ready", of: { id: 5, name: "Ambush" }, value: 9_999, look: "?", sound: "file:a.wav" }, 3],
    rules: { meter: { when: "boss", job: "cleric" }, boss: { when: "?", job: "x" } },
    alerts: { low: { on: true, value: 400, sound: "" }, nope: { on: true } },
    ready: [{ id: 0, name: "" }, { id: 4, name: "Soup" }],
    skip: [7, "x"],
    meter: { footer: ["odyle", "ping", "ping", "x"] },
    bosses: { 1: { notes: "n".repeat(9_000), mechanics: [{ id: 9, name: "Stomp", note: "jump", job: "x" }, { id: 0 }] } },
  });
  const [a, b] = s.auras;
  assert.deepEqual([a.kind, a.of, a.value, a.look, a.sound, b.kind, a.key === b.key], ["ready", { id: 5, name: "Ambush" }, 600, "icon", "file:a.wav", "on", false]);
  assert.deepEqual(s.rules, { meter: { when: "boss", job: "cleric" }, boss: { when: "always", job: "" } });
  assert.deepEqual([s.alerts.low.on, s.alerts.low.value, s.alerts.low.sound, s.alerts.low.banner, "nope" in s.alerts], [true, 100, "", true, false]);
  assert.deepEqual([s.ready.length, s.skip, s.meter.footer], [2, [7], ["ping", "odyle"]]);
  assert.equal(s.bosses["1"].notes.length, 2_000);
  assert.deepEqual(s.bosses["1"].mechanics, [{ id: 9, name: "Stomp", effect: false, note: "jump", job: "", say: false }]);
  assert.deepEqual(read(JSON.parse(JSON.stringify(s))), s);
});

test("a footer that was emptied stays empty, and one never set is the default", () => {
  assert.deepEqual([read({ meter: { footer: [] } }).meter.footer, read({ meter: {} }).meter.footer], [[], DEFAULTS.meter.footer]);
});

test("a resource without a name that is not shown is not kept", () => {
  const { resources } = read({ resources: [{ id: 4, name: "Keys" }, { id: 5 }, { id: 6, show: true }, { id: 0, name: "x" }, { id: 7, kind: "nightmare" }, { id: 8, kind: "?" }, 3] });
  assert.deepEqual(resources, [{ id: 4, name: "Keys", kind: "", show: false }, { id: 6, name: "", kind: "", show: true }, { id: 7, name: "", kind: "nightmare", show: false }]);
});

test("the map and pets keep only what fits", () => {
  const s = read({
    world: { map: 1110, layers: ["trace", "nonsense"], tracked: ["1110/trace", "1110/trace", 5], found: { "1110/trace": [12, 12, -1, "x"], "1110/cube": [] }, routes: [{ name: "Up", map: 0 }, { key: "r", name: "Run", map: 1110, points: [3, 2 ** 29] }], across: 9 },
    pets: { goal: 7, levels: { 1066: 3.4, 1004: 9, 9: 0, bad: "x" }, souls: { 1066: 24 }, told: 5 },
  });
  assert.deepEqual(s.world.layers, ["trace"]);
  assert.deepEqual(s.world.tracked, ["1110/trace"]);
  assert.deepEqual(s.world.found, { "1110/trace": [12] });
  assert.deepEqual(s.world.routes, [{ key: "r", name: "Run", map: 1110, points: [3] }]);
  assert.equal(s.world.across, 100);
  assert.deepEqual(s.pets, { goal: 3, levels: { 1066: 3, 1004: 3 }, souls: { 1066: 24 }, told: 5 });
  assert.deepEqual(read(null).world.layers, DEFAULTS.world.layers);
});

test("boss calls keep a known mode and only names turned off", () => {
  const s = read({ calls: { on: false, mode: "loud", voice: 1, off: ["thamon", "thamon", 4] } });
  assert.deepEqual(s.calls, { on: false, mode: "say", voice: true, off: ["thamon"] });
});

test("events and the clock keep only what fits", () => {
  const s = read({ events: { off: ["shugo", 3], before: 99 }, clock: { start: 5.4, stopped: -1, end: "x" } });
  assert.deepEqual([s.events, s.clock], [{ off: ["shugo"], before: 30 }, { start: 5, stopped: 0, end: 0 }]);
});

test("loot rules are item numbers, each once", () => {
  assert.deepEqual(read({ loot: { rules: [5, 5, -1, "x", 7.2], least: 9 } }).loot, { rules: [5, 7], least: 5 });
});
