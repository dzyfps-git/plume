interface Pressed {
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  code: string;
}

const NAMED = new Set(["Home", "End", "PageUp", "PageDown", "Insert", "Delete"]);

/** The keys pressed, as `hotkeys.rs` reads them. Nothing without Ctrl or Alt: the game would lose the key. */
export function hotkey({ ctrlKey, altKey, shiftKey, code }: Pressed): string | undefined {
  const key = /^Key[A-Z]$/.test(code) ? code[3]
    : /^Digit\d$/.test(code) ? code[5]
    : /^F([1-9]|1\d|2[0-4])$/.test(code) || NAMED.has(code) ? code
    : undefined;
  if (!key || (!ctrlKey && !altKey)) return undefined;
  return [ctrlKey && "Ctrl", altKey && "Alt", shiftKey && "Shift", key].filter(Boolean).join("+");
}
