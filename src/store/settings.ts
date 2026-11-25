// What you chose, with its defaults. Anything missing or wrong in the file falls back by itself.

export const VERSION = 1;
export const MODES = ["bossTargets", "lastHitByMe", "mostRecent", "mostDamage", "allTargets"] as const;
export const FPS = [30, 60, 120, 144, 0] as const;
export const STYLES = ["bar", "line", "table"] as const;
export const ACCENTS = ["", "ocean", "forest", "ember", "rose", "mono"] as const;
export const ACTIONS = ["overlay", "edit", "reset", "view"] as const;
/** What the meter shows, in the order its key goes through. The same as in `src-tauri/src/main.rs`. */
export const VIEWS = ["damage", "rdps", "healing", "taken", "hits"] as const;
export const TEXTS = [1, 1.15, 1.3] as const;

export type Mode = (typeof MODES)[number];
export type View = (typeof VIEWS)[number];
export type Action = (typeof ACTIONS)[number];

/** Where an overlay sits: 0 is the left or top edge of the screen, 1 the right or bottom. */
export interface Place {
  on: boolean;
  x: number;
  y: number;
  scale: number;
  /** How high it was at scale 1 when it was put there. */
  height?: number;
}

/** A hit you want to hear coming: which skill, and when in the fight. */
export interface Timer {
  skill: number;
  name: string;
  /** Seconds from the fight's start. */
  at: number[];
}

/** What you set for one boss, by its code. */
export interface BossPlan {
  /** Seconds until it enrages. 0 when not set. */
  enrage: number;
  /** Health marks, in percent, high to low. */
  marks: number[];
  /** Skills whose hits you could have avoided. */
  avoid: number[];
  timers: Timer[];
}

export interface Settings {
  version: number;
  live: boolean;
  mode: Mode;
  updateMs: number;
  /** Frames a second the bars move at. 0 is as fast as the screen. */
  fps: number;
  theme: "dark" | "light" | "auto";
  accent: string;
  /** Class colours that stay apart for colour-blind eyes. */
  safeColors: boolean;
  /** Text in the main window, as a factor. */
  text: number;
  voice: { on: boolean; volume: number; name: string; lead: number };
  bosses: Record<string, BossPlan>;
  hotkeys: Record<Action, string>;
  overlay: { on: boolean; onlyInGame: boolean; opacity: number; hideEmpty: boolean };
  meter: { style: (typeof STYLES)[number]; rows: number; share: boolean; total: boolean; icons: boolean; hideNames: boolean; view: View; edge: "top" | "bottom" };
  places: Record<string, Place>;
}

export const DEFAULTS: Settings = {
  version: VERSION,
  live: true,
  mode: "bossTargets",
  updateMs: 250,
  fps: 60,
  theme: "dark",
  accent: "",
  safeColors: false,
  text: 1,
  voice: { on: false, volume: 0.8, name: "", lead: 5 },
  bosses: {},
  hotkeys: { overlay: "Ctrl+Alt+F9", edit: "Ctrl+Alt+F10", reset: "Ctrl+Alt+F11", view: "Ctrl+Alt+F12" },
  overlay: { on: true, onlyInGame: true, opacity: 0.62, hideEmpty: true },
  meter: { style: "bar", rows: 8, share: true, total: false, icons: true, hideNames: false, view: "damage", edge: "top" },
  places: {},
};

const object = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const number = (v: unknown, least: number, most: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(most, Math.max(least, v)) : fallback;
const one = <T>(v: unknown, all: readonly T[], fallback: T) => (all.includes(v as T) ? (v as T) : fallback);
const flag = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export const place = (v: unknown, d: Place): Place => {
  const p = object(v);
  const height = number(p.height, 0, 5000, 0);
  return {
    on: flag(p.on, d.on), x: number(p.x, 0, 1, d.x), y: number(p.y, 0, 1, d.y), scale: number(p.scale, 0.6, 2, d.scale),
    ...(height > 0 && { height }),
  };
};

const numbers = (v: unknown, least: number, most: number, many: number): number[] =>
  (Array.isArray(v) ? v : []).filter((n): n is number => typeof n === "number" && n >= least && n <= most).slice(0, many);

/** A boss's plan, with nothing set where nothing is. */
export function plan(v: unknown): BossPlan {
  const b = object(v);
  return {
    enrage: Math.round(number(b.enrage, 0, 7200, 0)),
    marks: [...new Set(numbers(b.marks, 1, 99, 12))].sort((x, y) => y - x),
    avoid: numbers(b.avoid, 1, 2 ** 31, 200),
    timers: (Array.isArray(b.timers) ? b.timers : []).slice(0, 60).flatMap((t) => {
      const { skill, name, at } = object(t);
      const times = numbers(at, 0, 7200, 60);
      return typeof skill === "number" && times.length ? [{ skill, name: typeof name === "string" ? name : "", at: times }] : [];
    }),
  };
}

export function read(value: unknown): Settings {
  const s = object(value);
  const d = DEFAULTS;
  const [overlay, meter, hotkeys, voice] = [object(s.overlay), object(s.meter), object(s.hotkeys), object(s.voice)];
  return {
    version: VERSION,
    live: flag(s.live, d.live),
    mode: one(s.mode, MODES, d.mode),
    updateMs: number(s.updateMs, 50, 1000, d.updateMs),
    fps: one(s.fps as number, FPS as readonly number[], d.fps),
    theme: one(s.theme, ["dark", "light", "auto"] as const, d.theme),
    accent: one(s.accent as string, ACCENTS as readonly string[], d.accent),
    safeColors: flag(s.safeColors, d.safeColors),
    text: one(s.text as number, TEXTS as readonly number[], d.text),
    voice: {
      on: flag(voice.on, d.voice.on),
      volume: number(voice.volume, 0, 1, d.voice.volume),
      name: typeof voice.name === "string" ? voice.name : "",
      lead: number(voice.lead, 2, 15, d.voice.lead),
    },
    bosses: Object.fromEntries(Object.entries(object(s.bosses)).map(([code, b]) => [code, plan(b)])),
    hotkeys: Object.fromEntries(
      ACTIONS.map((a) => [a, typeof hotkeys[a] === "string" ? hotkeys[a] : d.hotkeys[a]]),
    ) as Settings["hotkeys"],
    overlay: {
      on: flag(overlay.on, d.overlay.on),
      onlyInGame: flag(overlay.onlyInGame, d.overlay.onlyInGame),
      opacity: number(overlay.opacity, 0.2, 1, d.overlay.opacity),
      hideEmpty: flag(overlay.hideEmpty, d.overlay.hideEmpty),
    },
    meter: {
      style: one(meter.style, STYLES, d.meter.style),
      rows: Math.round(number(meter.rows, 1, 24, d.meter.rows)),
      share: flag(meter.share, d.meter.share),
      total: flag(meter.total, d.meter.total),
      icons: flag(meter.icons, d.meter.icons),
      hideNames: flag(meter.hideNames, d.meter.hideNames),
      view: one(meter.view, VIEWS, d.meter.view),
      edge: one(meter.edge, ["top", "bottom"] as const, d.meter.edge),
    },
    // Each overlay reads its own place, with its own default.
    places: object(s.places) as Record<string, Place>,
  };
}

/** The easing that moves a bar over `ms` at `fps` frames a second. */
export const barEase = (fps: number, ms: number) =>
  fps === 0 ? "linear" : `steps(${Math.max(1, Math.round((fps * ms) / 1000))}, jump-end)`;
