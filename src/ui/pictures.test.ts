import assert from "node:assert/strict";
import { test } from "node:test";
import { dataUrl, pictureName, readPictures } from "./pictures.ts";

const all = readPictures({ skills: { 1335: "ICON_A" }, effects: { 133500001: "ICON_B", 5: "../x", 6: 7 } });

test("an effect has its own picture, or that of its skill", () => {
  assert.equal(pictureName(all, { effect: 133500001, skill: 13350000 }), "ICON_B");
  assert.equal(pictureName(all, { effect: 9, skill: 13350000 }), "ICON_A");
  assert.equal(pictureName(all, { skill: 13359999 }), "ICON_A");
  assert.equal(pictureName(all, { skill: 1335 }), undefined);
  assert.equal(pictureName(all, {}), undefined);
});

test("a list that is missing or wrong has no pictures", () => {
  for (const v of [null, 3, [], { skills: [] }]) assert.deepEqual(readPictures(v), { skills: {}, effects: {} });
  assert.equal(pictureName(all, { effect: 5 }), undefined, "a name that leaves the folder is no name");
  assert.equal(pictureName(all, { effect: 6 }), undefined);
});

test("bytes become an address of their own", () => {
  assert.equal(dataUrl(new Uint8Array([1, 2, 3])), "data:image/png;base64,AQID");
  assert.equal(dataUrl(new Uint8Array()), undefined);
});
