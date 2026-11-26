import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULTS, read } from "../store/settings.ts";
import { PACKS } from "./packs.ts";

test("every style pack gives settings that are kept as they are", () => {
  for (const pack of PACKS) {
    const s = structuredClone(DEFAULTS);
    pack.wear(s);
    assert.deepEqual(read(s), s, pack.name);
    assert.notDeepEqual(s, DEFAULTS, pack.name);
  }
});
