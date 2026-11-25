import assert from "node:assert/strict";
import { test } from "node:test";
import { hotkey } from "./keys.ts";

const press = (code: string, ctrlKey = false, altKey = false, shiftKey = false) => hotkey({ code, ctrlKey, altKey, shiftKey });

test("keys are written as the Rust side reads them", () => {
  assert.equal(press("F9", true, true), "Ctrl+Alt+F9");
  assert.equal(press("KeyD", false, true, true), "Alt+Shift+D");
  assert.equal(press("Digit1", true), "Ctrl+1");
  assert.equal(press("PageUp", true), "Ctrl+PageUp");
});

test("a key the game needs, or half a shortcut, is refused", () => {
  for (const code of ["F9", "KeyW", "ControlLeft", "F25", "Space"]) assert.equal(press(code), undefined);
  assert.equal(press("ControlLeft", true), undefined);
  assert.equal(press("KeyW", false, false, true), undefined);
});
