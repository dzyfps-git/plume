import assert from "node:assert/strict";
import { test } from "node:test";
import { elapsed, EVENTS, next, odds, serverTime, toggle, upcoming } from "./logic.ts";

const of = (id: string) => EVENTS.find((e) => e.id === id)!;
// Wednesday 25 November 2026, 20:01 on the server's clock.
const now = Date.UTC(2026, 10, 25, 11, 1);

test("events start on the server's clock and its days", () => {
  assert.equal(serverTime(now), "20:01");
  assert.deepEqual(next(of("shugo"), now), { event: of("shugo"), start: Date.UTC(2026, 10, 25, 11), open: true });
  assert.equal(next(of("invasion"), now).start, Date.UTC(2026, 10, 25, 11, 30));
  assert.equal(next(of("siege"), now).start, Date.UTC(2026, 10, 26, 12), "Thursday 21:00");
  assert.equal(next(of("nahma"), now).start, Date.UTC(2026, 10, 27, 12), "Friday 21:00");
  assert.equal(next(of("rift"), now).start, Date.UTC(2026, 10, 25, 12), "21:00, every three hours from midnight");
  const arena = next(of("arena"), Date.UTC(2026, 10, 25, 4, 30));
  assert.deepEqual([arena.start, arena.open], [Date.UTC(2026, 10, 25, 2), true], "open 11 to 14");
  assert.deepEqual(upcoming(now, ["shugo"]).map((n) => n.event.id).slice(0, 2), ["arena", "invasion"], "open first");
});

test("the stopwatch stops and goes on where it was", () => {
  let c = toggle({ start: 0, stopped: 0, end: 0 }, 1000);
  assert.equal(elapsed(c, 4000), 3000);
  c = toggle(c, 5000);
  assert.equal(elapsed(c, 9000), 4000);
  c = toggle(c, 10_000);
  assert.equal(elapsed(c, 11_000), 5000);
});

test("odds of a try", () => {
  assert.deepEqual(odds(0.5), { mean: 2, half: 1, most: 4 });
  assert.equal(odds(0.1)!.most, 22);
  assert.equal(odds(0), undefined);
});
