// Measures the release build on this PC and compares it with budgets.json. Runs at phase ends.
// Run `npm run tauri build` first and quit Plume. The overlays cover the screen for a while, with a made-up fight.
//
// PLUME_ENGINE=path runs that engine, so its RAM and CPU are measured too.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 9334;
const START_RUNS = 6;
const SETTLE_MS = 8000;
const FIGHT_MS = 15_000;

const budgets = JSON.parse(readFileSync("budgets.json", "utf8"));
const release = join("src-tauri", "target", "release");
const exe = join(release, "plume.exe");
if (!existsSync(exe)) throw new Error(`Build first: ${exe} is missing`);

const powershell = (script) => execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" }).trim();
const running = () => powershell("(Get-Process plume -ErrorAction SilentlyContinue | Measure-Object).Count") !== "0";
if (running()) throw new Error("Quit Plume first, from its tray icon.");

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function waitFor(check, ms = 20_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const value = await check();
      if (value) return value;
    } catch {
      // Not up yet.
    }
    await sleep(20);
  }
  throw new Error("Plume took too long");
}

/** A page of the app, through the debugger that only this script turns on. */
async function connect(name) {
  const url = await waitFor(async () => {
    const targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
    return targets.find((t) => t.type === "page" && t.url.includes(name))?.webSocketDebuggerUrl;
  });
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => ((socket.onopen = resolve), (socket.onerror = reject)));
  let next = 0;
  const waiting = new Map();
  socket.onmessage = ({ data }) => {
    const { id, result } = JSON.parse(data);
    waiting.get(id)?.(result);
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    waiting.set(++next, resolve);
    socket.send(JSON.stringify({ id: next, method, params }));
  });
  return {
    close: () => socket.close(),
    async run(expression) {
      const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    },
  };
}

const call = (page, command, args) => page.run(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)}, ${JSON.stringify(args)})`);

/** Each run keeps its settings and fights in a folder of its own, so the made-up fights never reach your History. */
const folders = [];
process.on("exit", () => folders.forEach((f) => rmSync(f, { recursive: true, force: true })));

function launch() {
  const startedAt = Date.now();
  const data = mkdtempSync(join(tmpdir(), "plume-bench-"));
  folders.push(data);
  const child = spawn(exe, {
    stdio: "ignore",
    env: { ...process.env, PLUME_DATA: data, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
  });
  return { startedAt, pid: child.pid };
}

function kill(pid) {
  try {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } catch {
    // It has already ended.
  }
}

/** Private working set, the number Task Manager shows, and CPU time, of the app and everything it started. */
function usage(pid) {
  const rows = JSON.parse(powershell(`
    $all = Get-CimInstance Win32_Process
    $tree = @{ ${pid} = $true }
    do { $more = $all | Where-Object { $tree[[int]$_.ParentProcessId] -and -not $tree[[int]$_.ProcessId] }
         $more | ForEach-Object { $tree[[int]$_.ProcessId] = $true } } while ($more)
    $ram = @{}
    Get-CimInstance Win32_PerfRawData_PerfProc_Process | ForEach-Object { $ram[[int]$_.IDProcess] = $_.WorkingSetPrivate }
    ConvertTo-Json @($all | Where-Object { $tree[[int]$_.ProcessId] } | ForEach-Object {
      @{ name = $_.Name; mb = $ram[[int]$_.ProcessId] / 1MB; cpu = ($_.KernelModeTime + $_.UserModeTime) / 10000 } })`));
  const sum = (key, which) => rows.filter((r) => which(r.name)).reduce((all, r) => all + r[key], 0);
  const engine = (name) => name === "plume-engine.exe";
  return {
    appMB: sum("mb", (n) => !engine(n)),
    engineMB: sum("mb", engine),
    cpuMs: sum("cpu", () => true),
  };
}

const starts = [];
for (let i = 0; i < START_RUNS; i++) {
  const { startedAt, pid } = launch();
  // Attaching during the start would slow what is being measured.
  await sleep(3000);
  const page = await connect("index.html").catch(() => connect("tauri.localhost"));
  starts.push((await waitFor(() => page.run(`performance.timeOrigin + (performance.getEntriesByName("ready")[0]?.startTime ?? NaN)`))) - startedAt);
  page.close();
  kill(pid);
  await sleep(1500);
}

const { pid } = launch();
let results;
try {
  await sleep(SETTLE_MS);
  const main = await connect("tauri.localhost");
  const mainOnly = usage(pid);

  await call(main, "edit_overlays", { on: true });
  await sleep(SETTLE_MS);
  const before = usage(pid);
  const begun = Date.now();
  await sleep(FIGHT_MS);
  const after = usage(pid);
  const cpuOfOneCore = ((after.cpuMs - before.cpuMs) / (Date.now() - begun)) * 100;
  const both = after;

  // What is left over the game once the main window is closed.
  await main.run(`setTimeout(() => window.__TAURI_INTERNALS__.invoke("plugin:window|close", { label: "main" }), 100)`);
  main.close();
  await sleep(SETTLE_MS);
  const overlayOnly = usage(pid);
  const overlay = await connect("overlay.html");
  await call(overlay, "edit_overlays", { on: false });
  overlay.close();

  const installers = join(release, "bundle", "nsis");
  const newest = existsSync(installers)
    ? readdirSync(installers).filter((n) => n.endsWith(".exe")).map((n) => statSync(join(installers, n))).sort((a, b) => b.mtimeMs - a.mtimeMs)[0]
    : undefined;
  results = {
    firstStartMs: starts[0],
    startMs: median(starts.slice(1)),
    mainRamMB: mainOnly.appMB,
    engineRamMB: both.engineMB,
    bothRamMB: both.appMB,
    overlayRamMB: overlayOnly.appMB,
    fightCpuPercent: cpuOfOneCore / cpus().length,
    cpuOfOneCore,
    installerMB: (newest?.size ?? NaN) / 1024 / 1024,
  };
} finally {
  kill(pid);
}

mkdirSync("bench-results", { recursive: true });
writeFileSync(join("bench-results", "latest.json"), JSON.stringify(results, null, 2));
let over = false;
for (const [name, value] of Object.entries(results)) {
  const budget = budgets[name];
  over ||= value > budget;
  console.log(`${name}: ${value.toFixed(1)}${budget ? ` (budget ${budget}) ${value > budget ? "OVER BUDGET" : "ok"}` : ""}`);
}
process.exitCode = over ? 1 : 0;
