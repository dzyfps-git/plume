import assert from "node:assert/strict";
import { test } from "node:test";
import { demoFight, demoSkills } from "../../live/demo.ts";
import type { Row } from "../../live/types.ts";
import { VIEWS } from "../../store/settings.ts";
import { label, length, lines, partyDps, ranked, shown } from "./logic.ts";

const row = (id: number, damage: number, you = false) => ({ id, name: you ? "Me" : `P${id}`, damage, you }) as Row;
const rows = [row(1, 100), row(2, 50), row(3, 25), row(4, 10, true)];

test("your row never falls off", () => {
  const list = rows.map((row) => ({ row }));
  assert.deepEqual(shown(list, 2).map(({ row, rank }) => [row.id, rank]), [[1, 1], [4, 4]]);
  assert.deepEqual(shown(list, 4).map(({ rank }) => rank), [1, 2, 3, 4]);
  assert.deepEqual(shown([], 3), []);
});

test("bars measure against the biggest", () => {
  assert.equal(length(rows[1], rows), 0.5);
  assert.equal(length(row(1, 0), [row(1, 0)]), 0);
});

test("names can be hidden, yours stays", () => {
  assert.deepEqual([label(rows[0], true, 1), label(rows[3], true, 4), label(row(9, 1), false, 2)], ["Player 1", "Me", "P9"]);
  assert.equal(label({ name: "", you: false }, false, 3), "Player 3");
});

test("the first second does not multiply the damage", () => {
  assert.equal(partyDps({ total: 500, ms: 100 }), 500);
  assert.equal(partyDps({ total: 500, ms: 2000 }), 250);
});

test("skill numbers come from hits", () => {
  const [line] = lines([{ ...demoSkills(1000)[0], hits: 4, damage: 200, crits: 1, backs: 2 }]);
  assert.deepEqual([line.share, line.average, line.crit, line.back], [1, 50, 0.25, 0.5]);
  assert.equal(lines([{ ...demoSkills(0)[0], hits: 0, damage: 0 }])[0].average, 0);
});

test("the made-up fight adds up", () => {
  for (const ms of [0, 250, 61_000, 179_999]) {
    const f = demoFight(ms);
    assert.equal(f.total, f.rows.reduce((sum, r) => sum + r.damage, 0));
    assert.ok(f.rows.every((r, i) => i === 0 || f.rows[i - 1].damage >= r.damage));
    assert.ok(f.target.hp >= 0);
  }
});

test("each view ranks by its own number, and counting buffs keeps the total", () => {
  const f = demoFight(60_000);
  for (const view of VIEWS) {
    const list = ranked(f, view);
    assert.ok(list.every((r, i) => i === 0 || list[i - 1].total >= r.total), view);
    assert.ok(Math.abs(list.reduce((sum, r) => sum + r.share, 0) - 100) < 1e-6, view);
  }
  const total = (view: "damage" | "rdps") => ranked(f, view).reduce((sum, r) => sum + r.total, 0);
  assert.equal(total("damage"), total("rdps"));
  assert.notDeepEqual(ranked(f, "damage").map((r) => r.total), ranked(f, "rdps").map((r) => r.total));
  assert.deepEqual(ranked(f, "healing").map((r) => r.row.job), ["cleric", "chanter"]);
  assert.deepEqual(ranked({ rows: [], ms: 0 }, "taken"), []);
});

test("an estimate of everyone else is never a name", () => {
  assert.equal(label({ name: "Others", you: false, others: true }, false, 2), "Everyone else, about");
});
