import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULTS, read } from "../store/settings.ts";
import { PACKS, putBack } from "./packs.ts";

test("every style pack gives settings that are kept as they are", () => {
  for (const pack of PACKS) {
    const s = structuredClone(DEFAULTS);
    pack.wear(s);
    assert.deepEqual(read(s), s, pack.name);
    assert.notDeepEqual(s, DEFAULTS, pack.name);
  }
});

test("putting a pack back undoes only what it changed and what was not changed since", () => {
  const was = structuredClone(DEFAULTS);
  const s = structuredClone(DEFAULTS);
  PACKS[0].wear(s);
  const worn = structuredClone(s);
  s.hotkeys.discreet = "F9";
  const changedSince = Object.keys(s.look)[0] as keyof typeof s.look;
  if (JSON.stringify(was.look[changedSince]) !== JSON.stringify(worn.look[changedSince])) (s.look as Record<string, unknown>)[changedSince] = "mine";
  putBack(s, was, worn);
  assert.equal(s.hotkeys.discreet, "F9");
  for (const k of Object.keys(s.look) as (keyof typeof s.look)[]) {
    if (k === changedSince && JSON.stringify(was.look[k]) !== JSON.stringify(worn.look[k])) assert.equal(s.look[k], "mine");
    else assert.deepEqual(s.look[k], was.look[k], k);
  }
});
