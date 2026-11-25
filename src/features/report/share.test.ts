import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSaved } from "../../live/demo.ts";
import { csv, fileName } from "./share.ts";

test("a spreadsheet gets one line a fight, no one else's name, and no formula", () => {
  const fight = { ...demoSaved("a", { ms: 141_000 }), target: '=HYPERLINK("x"), Boss' };
  const lines = csv([fight, fight]).split("\r\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes(`"'=HYPERLINK(""x""), Boss"`), lines[1]);
  assert.ok(!lines.join().includes("Maren"));
  assert.equal(csv([]).split("\r\n").length, 1);
});

test("a file is named by its fight", () => {
  assert.equal(fileName({ ...demoSaved("a", { ms: 60_000 }), start: Date.UTC(2026, 10, 24, 21, 5) }), "Stormbound Warden 2026-11-24-21-05");
});
