import assert from "node:assert/strict";
import { test } from "node:test";
import { health, lights } from "./health.ts";
import type { Reads } from "./types.ts";

const none: Reads = { hits: 0, taken: 0, health: 0, buffs: 0, stats: 0, targetHealth: false, stagger: false, you: false, zone: false, skills: 0, unnamed: 0 };
const light = (r: Partial<Reads>, name: string) => health({ ...none, ...r }).find((h) => h.name === name)!.light;

test("nothing read is trouble only once there was enough to read", () => {
  assert.equal(light({ hits: 20 }, "Buffs"), "wait");
  assert.equal(light({ hits: 400 }, "Buffs"), "bad");
  assert.equal(light({ hits: 400, buffs: 1 }, "Buffs"), "good");
  assert.equal(light({ hits: 400 }, "Hits taken"), "wait");
  assert.equal(light({ skills: 10, unnamed: 6 }, "Skill names"), "bad");
});

test("each light says what is missing", () => {
  const of = (engine: Parameters<typeof lights>[0], state: Parameters<typeof lights>[1]) => lights(engine, state, "Game").map((l) => l.light).join(" ");
  assert.equal(of({ status: "missing" }, null), "wait bad wait");
  assert.equal(of({ status: "failed", message: "It was not found. Install it from there." }, null), "bad wait wait");
  assert.equal(of({ status: "failed", message: "Broken" }, null), "wait bad wait");
  assert.equal(of({ status: "starting" }, null), "wait wait wait");
  assert.equal(of({ status: "running" }, { live: false, devices: 0 }), "bad good wait");
  assert.equal(of({ status: "running" }, { live: true, devices: 2 }), "good good good");
});
