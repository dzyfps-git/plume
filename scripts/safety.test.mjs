// What Plume must never do: touch the game's process, press keys for you, watch the screen, or use the network.
// A change that needs one of these needs a decision first, not a longer list here.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const files = ["src", "src-tauri/src"].flatMap((folder) =>
  readdirSync(join(root, folder), { recursive: true, withFileTypes: true })
    .filter((f) => f.isFile() && /\.(rs|ts|tsx|js|css|html)$/.test(f.name))
    .map((f) => join(f.parentPath, f.name)),
);
const uncommented = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");

const FORBIDDEN = {
  "another program's process": /OpenProcess|(Read|Write)ProcessMemory|VirtualAllocEx|CreateRemoteThread|NtOpenProcess|CreateToolhelp32|EnumProcesses|LoadLibrary|libloading|FindWindow|EnumWindows|GetWindowThreadProcessId/,
  "input made for you": /SendInput|keybd_event|mouse_event|SetCursorPos|SendMessage[AW]?\b|PostMessage[AW]\b/,
  "keys watched": /SetWindowsHook|GetAsyncKeyState|GetKeyState|GetKeyboardState|RegisterRawInput/,
  "the screen read": /BitBlt|PrintWindow|GetDC\b|GetPixel|GraphicsCapture|DuplicateOutput|getDisplayMedia/,
  "the network": /std::net|TcpStream|UdpSocket|TcpListener|reqwest|ureq|hyper::|tungstenite|pcap|windivert|raw.?socket|\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|RTCPeerConnection/i,
  "code made from text": /\beval\s*\(|new Function\s*\(/,
};

test("the app holds nothing that touches the game, the screen or the network", () => {
  assert.ok(files.length > 30);
  for (const file of files) {
    const text = uncommented(readFileSync(file, "utf8"));
    for (const [what, pattern] of Object.entries(FORBIDDEN)) {
      assert.equal(text.match(pattern)?.[0], undefined, `${file}: ${what}`);
    }
  }
});

test("no address outside this PC", () => {
  const fine = /^https?:\/\/(www\.w3\.org\/|(ipc\.)?localhost\b)/;
  for (const file of files) {
    for (const [address] of readFileSync(file, "utf8").matchAll(/https?:\/\/[^\s"'`)]+/g)) {
      assert.match(address, fine, file);
    }
  }
});

test("the window may reach only itself", () => {
  const { app, plugins } = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));
  assert.equal(plugins, undefined);
  const csp = app.security.csp;
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self' ipc: http:\/\/ipc\.localhost(;|$)/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe/);
  const { permissions } = JSON.parse(readFileSync(join(root, "src-tauri/capabilities/default.json"), "utf8"));
  for (const p of permissions) assert.match(p, /^core:(app|event|window):allow-/);
});

test("the only packages are the ones chosen", () => {
  const { dependencies } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.deepEqual(Object.keys(dependencies).sort(), ["@tauri-apps/api", "solid-js"]);
  const cargo = readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8");
  const crates = cargo.match(/\[dependencies\]([\s\S]*?)(\n\[|$)/)[1].match(/^[\w-]+(?= =)/gm);
  assert.deepEqual(crates.sort(), ["serde_json", "tauri", "tauri-plugin-single-instance", "windows"]);
});
