import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSaved, demoSkills } from "../../live/demo.ts";
import type { Entry, Saved } from "../../live/types.ts";
import { buffsBySkill, mvp, opening, overheal, partyCurve, pings, players, rates, standing, titles, unclean } from "./deep.ts";

const skill = demoSkills(1000)[0];

test("rates count direct hits, and leave out what is not known", () => {
  const { multis: _, parries: __, ...old } = skill;
  const list = [{ ...old, hits: 10, crits: 5, backs: 10, perfects: 0, doubles: 1 }, { ...skill, dot: true, hits: 90, crits: 0 }];
  assert.deepEqual(rates(list).map((r) => [r.name, r.share]), [["Crit", 0.5], ["Back", 1], ["Perfect", 0], ["Double", 0.1]]);
  assert.deepEqual(rates([{ ...skill, hits: 4, multis: 2, parries: 1 }]).slice(4).map((r) => r.share), [0.5, 0.25]);
  assert.deepEqual(rates([]), []);
});

test("the opener is casts, not hits", () => {
  const hits: Entry[] = [[0, 1, 5, 0], [300, 1, 5, 0], [1_500, 2, 5, 0], [1_600, 3, 5, 256], [21_000, 1, 5, 0]];
  assert.deepEqual(opening({ casts: hits }).map((c) => [c.skill, c.hits]), [[1, 2], [2, 1]]);
});

test("buffs are counted for the casts of each skill", () => {
  const buff = (id: number, on: number, by: number, spans: [number, number, number][], passive = false) => ({
    id, name: `B${id}`, on, by, skill: 0, passive, up: spans.reduce((n, s) => n + s[1] - s[0], 0), spans,
  });
  const fight = {
    ms: 10_000, you: { id: 1 }, rows: [{ id: 1, you: true }, { id: 2, you: false }],
    casts: [[1_000, 7, 10, 0], [1_300, 7, 10, 0], [6_000, 7, 10, 0], [2_000, 8, 50, 0], [2_500, 8, 5, 256]],
    buffs: [buff(1, 1, 1, [[0, 5_000, 1]]), buff(2, 900, 1, [[5_500, 7_000, 1]]), buff(3, 2, 1, [[0, 5_000, 1]]), buff(4, 1, 1, [], true), buff(5, 1, 1, [[0, 10_000, 1]])],
  } as unknown as Saved;
  const { buffs, rows } = buffsBySkill(fight);
  assert.deepEqual(buffs.map((b) => b.id), [1, 2]);
  assert.deepEqual(rows, [{ skill: 8, casts: 1, shares: [1, 0] }, { skill: 7, casts: 2, shares: [0.5, 0.5] }]);
  assert.deepEqual(buffsBySkill({ ...fight, buffs: [] }).rows, []);
});

test("buffs move damage between players, and none of it is lost", () => {
  const fight = demoSaved("x", { ms: 120_000, killed: true });
  const all = players(fight);
  const sum = (of: (p: (typeof all)[number]) => number) => Math.round(all.reduce((n, p) => n + of(p), 0));
  assert.equal(sum((p) => p.rdps!), sum((p) => p.dps));
  const chanter = all.find((p) => p.id === 7)!;
  assert.ok(chanter.rdps! > chanter.dps && chanter.ndps === chanter.dps && chanter.support > 0);
  // Without what buffs moved, the figures that need it are not known, not the raw damage a second.
  const bare = players({ ...fight, rows: fight.rows!.map(({ got: _, given: __, ...r }) => r) })[0];
  assert.deepEqual([bare.rdps, bare.ndps], [undefined, undefined]);
  assert.equal(all.find((p) => p.id === 1)!.support, 0, "your buffs on yourself support nobody");
  assert.equal(partyCurve(fight)!.at(-1), fight.total);
  assert.equal(partyCurve({ ...fight, rows: undefined }), undefined);
});

test("overheal is a part of what could be weighed", () => {
  assert.equal(overheal([{ ...skill, weighed: 300, over: 100 }, { ...skill, weighed: 100 }, skill]), 0.25);
  assert.equal(overheal([skill]), undefined);
  assert.ok(Math.abs(players(demoSaved("x", { ms: 60_000, killed: true })).find((p) => p.id === 8)!.over! - 0.4) < 0.1);
});

test("the MVP did the most for the party, not only the most damage", () => {
  const row = (id: number, more: object) => ({ id, damage: 0, taken: 0, deaths: 0, skills: [], ...more });
  const of = (...rows: object[]) => mvp({ rows, dummy: false } as unknown as Saved);
  assert.equal(of(row(1, { damage: 100 }), row(2, { damage: 90 }))?.id, 1);
  assert.equal(of(row(1, { damage: 100, got: 10 }), row(2, { damage: 90, given: 10 }))?.id, 2);
  assert.equal(of(row(1, { damage: 100, deaths: 1 }), row(2, { damage: 95 }))?.id, 2);
  assert.equal(of(row(1, { damage: 60, taken: 100 }), row(2, { damage: 45, healing: 100 }))?.id, 2);
  // Healing that nobody needed does not count.
  assert.equal(of(row(1, { damage: 60, taken: 10_000 }), row(2, { damage: 45, healing: 100 }))?.id, 1);
  assert.equal(of(row(1, { damage: 60, taken: 100 }), row(2, { damage: 45, healing: 100, heals: [{ ...skill, weighed: 100, over: 100 }] }))?.id, 1);
  assert.equal(of(row(1, { damage: 100 })), undefined);
  assert.equal(mvp(demoSaved("x", { ms: 60_000, dummy: true })), undefined);
});

test("places go by the MVP's points, and nobody has two titles", () => {
  const f = demoSaved("x", { ms: 150_000, killed: true });
  const all = standing(f);
  assert.equal(all.length, f.rows!.length);
  assert.ok(all.every((m, i) => i === 0 || all[i - 1].points >= m.points));
  const named = titles(f);
  assert.equal(named.get(8), "Most healing, 763K");
  assert.equal(named.get(7)?.startsWith("Buffs gave "), true);
  assert.ok([...named.keys()].every((id) => f.rows!.some((r) => r.id === id)));
  assert.equal(new Set(named.values()).size, named.size);
  assert.deepEqual([titles(demoSaved("x", { ms: 60_000, dummy: true })).size, titles({ ...f, rows: undefined }).size, standing({ ...f, rows: undefined })], [0, 0, []]);
  // A fight from before has no long lists.
  assert.equal(titles({ ...f, rows: f.rows!.map((r) => ({ ...r, skills: [], heals: undefined, curve: undefined, given: 0, healing: 0, stagger: 0 })) }).size, 0);
});

test("ping holds until the next is known", () => {
  assert.deepEqual(pings({ ms: 4_000, pings: [[0, 40], [2_000, 60]] }), { line: [40, 40, 60, 60, 60], least: 40, most: 60, average: 50 });
  assert.equal(pings({ ms: 4_000, pings: [] }), undefined);
  assert.equal(pings({ ms: 4_000 }), undefined);
});

test("a run is clean when nothing was off", () => {
  const hits = Array.from({ length: 60 }, (_, i): Entry => [i * 1_000, i % 2, 100, 0]);
  const run = { dummy: true, ms: 60_000, players: 1, you: { id: 1 }, casts: hits, buffs: [], curve: [], health: [] } as unknown as Saved;
  assert.deepEqual(unclean(run), []);
  assert.deepEqual(unclean({ ...run, players: 2, casts: hits.filter((h) => h[0] < 20_000 || h[0] > 26_000) }), ["you paused at 0:19", "someone else hit it too"]);
  assert.deepEqual(unclean({ ...run, buffs: [{ on: 1, by: 0, passive: false, name: "Song" }] as never }), ["you had a buff from someone else, Song"]);
  assert.deepEqual(unclean({ ...run, dummy: false, players: 5 }), []);
  assert.equal(demoSaved("x", { ms: 60_000, dummy: true }).pings!.length > 2, true);
});
