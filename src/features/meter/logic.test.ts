import assert from "node:assert/strict";
import { test } from "node:test";
import { demoFight, demoSkills } from "../../live/demo.ts";
import { NO_ENTRIES, type Row } from "../../live/types.ts";
import { DEFAULTS, VIEWS, type Footer, type Resource } from "../../store/settings.ts";
import { strip } from "../resources/logic.ts";
import { against, BEST, bursts, footer, gain, gap, odyleFoot, label, length, lines, partyDps, power, ranked, shown, signed, withBest } from "./logic.ts";

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

test("Combat Power is short, and nothing when not known", () => {
  assert.deepEqual([power(112_012), power(950), power(0)], ["112.0K", "950", ""]);
});

test("a fight is held against your kept ones of the same target", () => {
  const now = { ms: 60_000, target: { code: 5, name: "Boss" }, rows: [{ ...rows[3], dps: 104 }] } as never;
  const kept = (code: number, ms: number, dps: number, damage = 1) => ({ code, ms, target: "Boss", you: { dps, damage } }) as never;
  assert.deepEqual(against(now, []), { pull: 1 });
  const a = against(now, [kept(5, 60_000, 100), kept(5, 5_000, 900), kept(6, 60_000, 800), kept(5, 60_000, 300, 10)])!;
  assert.deepEqual([a.pull, a.best, signed(a.change!)], [3, 100, "+4%"]);
  assert.equal(against({ ...(now as object), rows: [] } as never, []), undefined);
  assert.equal(signed(-0.123), "-12%");
});

test("a kept fight is a new best when none before it was better", () => {
  const kept = (id: string, dps: number, more: object = {}) => ({ id, ms: 60_000, code: 5, target: "Boss", you: { dps, damage: dps * 60, job: "assassin" }, ...more }) as never;
  const all = [kept("a", 100), kept("b", 120), kept("c", 900, { ms: 5_000 }), kept("d", 900, { you: { dps: 900, damage: 1, job: "cleric" } })];
  assert.equal(signed(gain(kept("new", 132), [...all, kept("new", 132)])!), "+10%");
  assert.deepEqual([gain(kept("new", 110), all), gain(kept("new", 110), []), gain(kept("new", 110, { you: null }), all)], [undefined, undefined, undefined]);
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

test("the footer says what you chose and what is known", () => {
  const near = { ping: 40, odyle: [120, 1_335] as [number, number], flight: null };
  const entries = { ...NO_ENTRIES, counts: [[1, 5, 1], [4, 2, 0]] as [number, number, number][], kinah: 182_300 };
  const chosen = [{ id: 1, name: "", kind: "", show: true }, { id: 4, name: "Mine", kind: "", show: true }] as Resource[];
  const said = (which: Footer[], n: typeof near, e: typeof NO_ENTRIES) =>
    footer(which, n, { total: 1_500, own: [200, 88, 121] }, e, strip(e, n.odyle, chosen), { ...DEFAULTS, odyleRun: 80 }).map((f) => [f.name, f.icon ?? f.thing ?? "", f.value, f.bonus ?? "", f.more].join(" ").trim());
  assert.deepEqual(said(["ping", "total", "flight", "odyle", "entries", "kina", "points", "crit", "back"], near, entries), [
    "Ping ping 40  ms", "Total  1.50K", "Odyle Energy odyle 120 +1,335 18 runs", "Shugo Festival keys shugo 5 +1", "Mine  2", "Kina today kina 182K", "Crit  44%", "Back  61%",
  ]);
  assert.deepEqual(said(["ping", "entries", "kina"], { ...near, ping: -1 }, NO_ENTRIES), []);
});

test("your best stands among the rows without taking a place", () => {
  const f = demoFight(60_000);
  const list = ranked(f, "damage");
  assert.deepEqual(withBest(list, undefined, f.ms, ""), list);
  const best = (list[0].total + list[1].total) / 2 / 60;
  const all = shown(withBest(list, best, f.ms, "assassin"), 8);
  assert.deepEqual(all.slice(0, 3).map((r) => [r.row.id === BEST, r.rank]), [[false, 1], [true, 0], [false, 2]]);
  assert.equal(withBest(list, 1, f.ms, "").at(-1)!.row.id, BEST);
  assert.equal(shown(withBest(list, 1e9, f.ms, ""), 2).filter((r) => r.row.you).length, 1);
});

test("Odyle Energy says what you want of it, and warns", () => {
  const said = (odyle: [number, number], more: object) => odyleFoot(odyle, { odyleRun: 40, odyle: { ...DEFAULTS.odyle, ...more } });
  assert.deepEqual([said([420, 35], { parts: ["energy", "cap"] }).more, said([420, 35], { parts: ["energy", "cap"] }).bonus], ["of 560", ""]);
  assert.equal(said([420, 0], { parts: ["cap"], member: true }).more, "of 840");
  const took = (runMs: number) => odyleFoot([420, 35], { odyleRun: 40, odyle: { ...DEFAULTS.odyle, parts: ["time"] }, runMs }).more;
  assert.deepEqual([took(600_000), took(0)], ["about 1 h 50 m", ""]);
  assert.deepEqual([said([520, 0], {}).tone, said([520, 0], {}).more, said([560, 0], { parts: [] }).more, said([520, 0], { warn: false }).tone], ["ending", "13 runs, nearly full", "full", undefined]);
  assert.deepEqual([said([520, 0], { member: true }).tone, said([-1, -1], {}).more], [undefined, "log in once more"]);
});

test("you can stand first, and how far the next place is", () => {
  const list = rows.map((row) => ({ row, rate: row.damage }));
  assert.deepEqual(shown(list, 2, true).map(({ row, rank }) => [row.id, rank]), [[4, 4], [1, 1]]);
  assert.deepEqual([gap(list), gap(list.slice(3)), gap(list.slice(0, 2))], [15, undefined, undefined]);
});

test("a burst is far above one's own average", () => {
  const look = bursts();
  const at = (ms: number, a: number, b: number) => look({ ms, rows: [{ ...row(1, a), others: false }, { ...row(2, b), others: false }] });
  for (let s = 1; s <= 20; s++) assert.equal(at(s * 1000, s * 100, s * 100).size, 0, String(s));
  for (let s = 21; s <= 24; s++) at(s * 1000, 2_000 + (s - 20) * 400, s * 100);
  assert.deepEqual([...at(25_000, 4_000, 2_500)], [1]);
  assert.equal(at(1_000, 100, 100).size, 0);
});
