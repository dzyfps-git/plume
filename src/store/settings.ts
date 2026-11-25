// What you chose, with its defaults. Anything missing or wrong in the file falls back by itself.

export const VERSION = 1;
export const MODES = ["bossTargets", "lastHitByMe", "mostRecent", "mostDamage", "allTargets"] as const;
export const FPS = [30, 60, 120, 144, 0] as const;
export const STYLES = ["bar", "line", "table"] as const;
export const ACCENTS = ["", "ocean", "forest", "ember", "rose", "mono"] as const;
export const ACTIONS = ["overlay", "edit", "reset"] as const;

export type Mode = (typeof MODES)[number];
export type Action = (typeof ACTIONS)[number];

/** Where an overlay sits: 0 is the left or top edge of the screen, 1 the right or bottom. */
export interface Place {
  on: boolean;
  x: number;
  y: number;
  scale: number;
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
  hotkeys: Record<Action, string>;
  overlay: { on: boolean; onlyInGame: boolean; opacity: number; hideEmpty: boolean };
  meter: { style: (typeof STYLES)[number]; rows: number; share: boolean; total: boolean; icons: boolean; hideNames: boolean };
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
  hotkeys: { overlay: "Ctrl+Alt+F9", edit: "Ctrl+Alt+F10", reset: "Ctrl+Alt+F11" },
  overlay: { on: true, onlyInGame: true, opacity: 0.62, hideEmpty: true },
  meter: { style: "bar", rows: 8, share: true, total: false, icons: true, hideNames: false },
  places: {},
};

const object = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const number = (v: unknown, least: number, most: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(most, Math.max(least, v)) : fallback;
const one = <T>(v: unknown, all: readonly T[], fallback: T) => (all.includes(v as T) ? (v as T) : fallback);
const flag = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export const place = (v: unknown, d: Place): Place => {
  const p = object(v);
  return { on: flag(p.on, d.on), x: number(p.x, 0, 1, d.x), y: number(p.y, 0, 1, d.y), scale: number(p.scale, 0.6, 2, d.scale) };
};

export function read(value: unknown): Settings {
  const s = object(value);
  const d = DEFAULTS;
  const [overlay, meter, hotkeys] = [object(s.overlay), object(s.meter), object(s.hotkeys)];
  return {
    version: VERSION,
    live: flag(s.live, d.live),
    mode: one(s.mode, MODES, d.mode),
    updateMs: number(s.updateMs, 50, 1000, d.updateMs),
    fps: one(s.fps as number, FPS as readonly number[], d.fps),
    theme: one(s.theme, ["dark", "light", "auto"] as const, d.theme),
    accent: one(s.accent as string, ACCENTS as readonly string[], d.accent),
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
    },
    // Each overlay reads its own place, with its own default.
    places: object(s.places) as Record<string, Place>,
  };
}

/** The easing that moves a bar over `ms` at `fps` frames a second. */
export const barEase = (fps: number, ms: number) =>
  fps === 0 ? "linear" : `steps(${Math.max(1, Math.round((fps * ms) / 1000))}, jump-end)`;
