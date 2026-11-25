// What you chose, with its defaults. Anything missing or wrong in the file falls back by itself.

import type { Job } from "../live/types.ts";

export const VERSION = 1;
export const MODES = ["bossTargets", "lastHitByMe", "mostRecent", "mostDamage", "allTargets"] as const;
export const FPS = [30, 60, 120, 144, 0] as const;
export const STYLES = ["bar", "line", "table"] as const;
export const ACCENTS = ["", "ocean", "forest", "ember", "rose", "mono"] as const;
export const ACTIONS = ["overlay", "edit", "reset", "view", "quick"] as const;
/** What the meter shows, in the order its key goes through. The same as in `src-tauri/src/main.rs`. */
export const VIEWS = ["damage", "rdps", "healing", "taken", "hits"] as const;
export const WHEN = ["always", "fight", "boss", "dungeon", "pvp", "calm"] as const;
export const FOOTER = ["ping", "total", "flight", "odyle"] as const;
export const AURA_KINDS = ["on", "missing", "target", "untarget", "ready", "low", "party"] as const;
export const LOOKS = ["icon", "bar", "text"] as const;
/** What each is stands in `src/features/alerts/logic.ts`. */
export const ALERTS = ["low", "ally", "died", "fight", "held", "enrage", "kill", "slain"] as const;
const JOBS: readonly Job[] = ["gladiator", "templar", "ranger", "assassin", "sorcerer", "cleric", "spiritmaster", "chanter", "fighter", ""];
export const TEXTS = [1, 1.15, 1.3] as const;

export type Mode = (typeof MODES)[number];
export type View = (typeof VIEWS)[number];
export type When = (typeof WHEN)[number];
export type Footer = (typeof FOOTER)[number];
export type AlertId = (typeof ALERTS)[number];
export type Action = (typeof ACTIONS)[number];

/** Where an overlay sits: 0 is the left or top edge of the screen, 1 the right or bottom. */
export interface Place {
  on: boolean;
  x: number;
  y: number;
  scale: number;
  /** How high it was at scale 1 when it was put there. */
  height?: number;
  /** Stays where it is while others are moved. */
  locked?: boolean;
}

/** When an overlay may show. */
export interface Rule {
  when: When;
  /** Only on this class. Empty is all. */
  job: Job;
}

/** An effect or a skill, by its number and its name: ranks of one have different numbers. */
export interface Named {
  id: number;
  name: string;
}

/** How to get your attention. */
export interface Signal {
  /** A sound of `alerts/sound.ts`, or "file:" and the name of your own. Empty is none. */
  sound: string;
  say: boolean;
}

export interface AuraRule extends Signal {
  key: string;
  kind: (typeof AURA_KINDS)[number];
  of: Named;
  /** Seconds left, or health in percent. What it means depends on the kind. */
  value: number;
  look: (typeof LOOKS)[number];
  glow: boolean;
  /** Only in fights. */
  fight: boolean;
  on: boolean;
}

export interface Alert extends Signal {
  on: boolean;
  banner: boolean;
  /** Health in percent, for those that watch it. */
  value: number;
}

/** A boss's skill or effect that you want a word about. */
export interface Mechanic extends Named {
  effect: boolean;
  note: string;
  /** Only on this class. Empty is all. */
  job: Job;
  say: boolean;
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
  mechanics: Mechanic[];
  notes: string;
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
  meter: { style: (typeof STYLES)[number]; rows: number; share: boolean; total: boolean; icons: boolean; hideNames: boolean; view: View; edge: "top" | "bottom"; footer: Footer[] };
  places: Record<string, Place>;
  /** When each overlay may show. One that is not here always may. */
  rules: Record<string, Rule>;
  auras: AuraRule[];
  /** Effects to have on before a pull. The number 0 is any food or other item. */
  ready: Named[];
  /** Skills left off the action bars. */
  skip: number[];
  alerts: Record<AlertId, Alert>;
  /** Starts with Windows. */
  startup: boolean;
  /** Closes the overlay window while the game is closed. */
  sleep: boolean;
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
  hotkeys: { overlay: "Ctrl+Alt+F9", edit: "Ctrl+Alt+F10", reset: "Ctrl+Alt+F11", view: "Ctrl+Alt+F12", quick: "Ctrl+Alt+F8" },
  overlay: { on: true, onlyInGame: true, opacity: 0.62, hideEmpty: true },
  meter: { style: "bar", rows: 8, share: true, total: false, icons: true, hideNames: false, view: "damage", edge: "top", footer: [] },
  places: {},
  rules: {},
  auras: [],
  ready: [],
  skip: [],
  alerts: {
    low: { on: false, banner: true, sound: "alarm", say: false, value: 30 },
    ally: { on: false, banner: true, sound: "drop", say: false, value: 25 },
    died: { on: false, banner: true, sound: "fall", say: false, value: 0 },
    fight: { on: false, banner: false, sound: "chime", say: false, value: 0 },
    held: { on: false, banner: false, sound: "drop", say: false, value: 0 },
    enrage: { on: false, banner: true, sound: "alarm", say: false, value: 0 },
    kill: { on: false, banner: true, sound: "rise", say: false, value: 0 },
    slain: { on: false, banner: false, sound: "fall", say: false, value: 0 },
  },
  startup: false,
  sleep: true,
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
    ...(p.locked === true && { locked: true }),
  };
};

const numbers = (v: unknown, least: number, most: number, many: number): number[] =>
  (Array.isArray(v) ? v : []).filter((n): n is number => typeof n === "number" && n >= least && n <= most).slice(0, many);

const text = (v: unknown, most: number) => (typeof v === "string" ? v.slice(0, most) : "");
const list = (v: unknown, most: number) => (Array.isArray(v) ? v : []).slice(0, most).map(object);
const named = (v: Record<string, unknown>): Named => ({ id: Math.round(number(v.id, 0, 2 ** 32, 0)), name: text(v.name, 120) });
const signal = (v: Record<string, unknown>, d: Signal): Signal => ({ sound: typeof v.sound === "string" ? text(v.sound, 120) : d.sound, say: flag(v.say, d.say) });

export const rule = (v: unknown): Rule => {
  const r = object(v);
  return { when: one(r.when as When, WHEN, "always"), job: one(r.job as Job, JOBS, "") };
};

const aura = (v: Record<string, unknown>, at: number): AuraRule => ({
  key: text(v.key, 40) || `aura-${at}`,
  kind: one(v.kind as AuraRule["kind"], AURA_KINDS, "on"),
  of: named(object(v.of)),
  value: number(v.value, 0, 600, 0),
  look: one(v.look as AuraRule["look"], LOOKS, "icon"),
  glow: flag(v.glow, false),
  fight: flag(v.fight, false),
  on: flag(v.on, true),
  ...signal(v, { sound: "", say: false }),
});

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
    mechanics: list(b.mechanics, 60).map((m) => ({
      ...named(m), effect: flag(m.effect, false), note: text(m.note, 200), job: one(m.job as Job, JOBS, ""), say: flag(m.say, false),
    })).filter((m) => m.id > 0),
    notes: text(b.notes, 2000),
  };
}

export function read(value: unknown): Settings {
  const s = object(value);
  const d = DEFAULTS;
  const [overlay, meter, hotkeys, voice, alerts] = [object(s.overlay), object(s.meter), object(s.hotkeys), object(s.voice), object(s.alerts)];
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
      footer: FOOTER.filter((f) => Array.isArray(meter.footer) && meter.footer.includes(f)),
    },
    // Each overlay reads its own place, with its own default.
    places: object(s.places) as Record<string, Place>,
    rules: Object.fromEntries(Object.entries(object(s.rules)).map(([id, r]) => [id, rule(r)])),
    auras: list(s.auras, 60).map(aura),
    ready: list(s.ready, 40).map(named),
    skip: numbers(s.skip, 1, 2 ** 31, 200),
    alerts: Object.fromEntries(
      ALERTS.map((id) => {
        const a = object(alerts[id]);
        const f = d.alerts[id];
        return [id, { on: flag(a.on, f.on), banner: flag(a.banner, f.banner), value: number(a.value, 0, 100, f.value), ...signal(a, f) }];
      }),
    ) as Settings["alerts"],
    startup: flag(s.startup, d.startup),
    sleep: flag(s.sleep, d.sleep),
  };
}

/** The easing that moves a bar over `ms` at `fps` frames a second. */
export const barEase = (fps: number, ms: number) =>
  fps === 0 ? "linear" : `steps(${Math.max(1, Math.round((fps * ms) / 1000))}, jump-end)`;
