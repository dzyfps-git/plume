import assert from "node:assert/strict";
import { test } from "node:test";
import { fillJobs, type Jobs } from "./jobs.ts";
import { NO_FIGHT, NO_NEAR, type Fight, type Near } from "./types.ts";

test("a class once seen stays with its name until the engine says it again", () => {
  const known: Jobs = {};
  const you = (job: string) => ({ ...NO_NEAR, you: { name: "dzy", job } }) as unknown as Near;
  fillJobs(you("sorcerer"), known);
  assert.equal(fillJobs(you(""), known).you!.job, "sorcerer");
  const fight = { ...NO_FIGHT, rows: [{ name: "dzy", job: "" }, { name: "Other", job: "" }] } as unknown as Fight;
  assert.deepEqual(fillJobs(fight, known).rows.map((r) => r.job), ["sorcerer", ""]);
});
