// What you chose, with its defaults. Anything missing or wrong in the file falls back by itself.

import type { Job } from "../live/types.ts";

export const VERSION = 1;
export const MODES = ["bossTargets", "lastHitByMe", "mostRecent", "mostDamage", "allTargets"] as const;
export const FPS = [30, 60, 120, 144, 0] as const;
export const STYLES = ["bar", "line", "cards", "gauge", "table"] as const;
export const ACCENTS = ["", "ocean", "forest", "ember", "rose", "mono"] as const;
/** What a key over the game can do. `pressed` in `src-tauri/src/main.rs` does it. */
export const ACTIONS = ["overlay", "edit", "reset", "view", "quick", "compact", "lock", "peek", "discreet", "history", "details", "settings", "buffs", "actions", "second"] as const;
/** What the meter shows, in the order its key goes through. The same as in `src-tauri/src/main.rs`. */
export const VIEWS = ["damage", "rdps", "ndps", "healing", "taken", "hits"] as const;
export const WHEN = ["always", "fight", "boss", "dungeon", "pvp", "calm"] as const;
export const FOOTER = ["ping", "total", "flight", "odyle", "entries", "kina", "points", "crit", "back"] as const;
/** Buttons on the meter. */
export const BUTTONS = ["view", "clear", "history", "compact", "lock", "sound", "clock", "news", "second", "menu"] as const;
/** What can stand beside a row's number, and by a name. */
export const SIDES = ["", "total", "share"] as const;
export const CORNERS = ["power", "level", ""] as const;
export const THEMES = ["glass", "minimal", "solid", "light"] as const;
export const OUTLINES = ["", "soft", "solid"] as const;
export const FONTS = ["house", "narrow", "round", "mono"] as const;
export const ODYLE = ["energy", "charged", "cap", "runs", "time"] as const;
export const ONLY = ["", "boss", "dungeon"] as const;
/** What can stand on the second screen, by its feature. `curve` is its own. */
export const SECOND = ["meter", "boss", "curve", "splits", "finish", "timers", "target", "foe", "resources", "party", "force", "buffs", "debuffs", "partyDebuffs", "actions", "flight", "ping"] as const;
/** You against your best: what shows of it. */
export const AGAINST = ["rival", "time", "wipes", "grade", "burst", "tip", "streak", "art"] as const;
/** What a colour says, everywhere. */
export const TONES = ["bonus", "best", "ready", "ending", "danger", "you"] as const;
/** How many fights are kept. 0 is all. */
export const KEEP = [5, 10, 25, 50, 100, 0] as const;
/** Seconds of a training run. 0 is no limit. */
export const RUNS = [30, 60, 120, 180, 300, 0] as const;
/** What a ticket or an entry can be. Each has an icon in `src/ui/icons.tsx`. */
export const KINDS = ["shugo", "invasion", "nightmare", "ascension", "transcendence", "conquest", "exploration", "fissure", "subjugation", "forge", "rift"] as const;
export const AURA_KINDS = ["on", "missing", "target", "untarget", "ready", "low", "party"] as const;
export const LOOKS = ["icon", "bar", "text"] as const;
/** What each is stands in `src/features/alerts/logic.ts`. */
export const ALERTS = ["low", "ally", "died", "fight", "held", "enrage", "kill", "slain", "best", "record"] as const;
export const JOBS: readonly Job[] = ["gladiator", "templar", "ranger", "assassin", "sorcerer", "cleric", "spiritmaster", "chanter", "fighter", ""];
/** Odyle Energy a run takes: once, or claimed twice. */
export const ODYLE_RUN = [40, 80] as const;
export const TEXTS = [1, 1.15, 1.3] as const;

export type Mode = (typeof MODES)[number];
export type View = (typeof VIEWS)[number];
export type When = (typeof WHEN)[number];
export type Footer = (typeof FOOTER)[number];
export type Kind = (typeof KINDS)[number];
export type AlertId = (typeof ALERTS)[number];
export type Action = (typeof ACTIONS)[number];
export type Button = (typeof BUTTONS)[number];
export type Tone = (typeof TONES)[number];

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

/** A ticket or an entry, by the game's number for it. */
export interface Resource {
  id: number;
  /** What you call it. */
  name: string;
  /** What it is, when you said so. */
  kind: Kind | "";
  show: boolean;
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
  /** Stands in a place of its own, not among the others. */
  own: boolean;
  on: boolean;
}

export interface Alert extends Signal {
  on: boolean;
  banner: boolean;
  /** Health in percent, for those that watch it. */
  value: number;
  /** How loud its sound is, of the whole. */
  volume: number;
}

/** The page for another screen: what stands on it, by its size, and where it is. */
export interface Second {
  parts: (typeof SECOND)[number][];
  size: number;
  /** Left, top, width and height in points of the screen, as it was when it closed. */
  at?: number[];
  /** It filled its screen. */
  full: boolean;
  /** Opens with Plume. */
  open: boolean;
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

export interface Meter {
  style: (typeof STYLES)[number];
  rows: number;
  /** What stands beside the number. */
  left: (typeof SIDES)[number];
  right: (typeof SIDES)[number];
  /** Numbers with all their figures. */
  full: boolean;
  icons: boolean;
  /** By a name: yours, or the party's too. */
  corner: (typeof CORNERS)[number];
  corners: "you" | "all";
  head: boolean;
  boss: boolean;
  clock: boolean;
  ghost: boolean;
  hideNames: boolean;
  view: View;
  edge: "top" | "bottom";
  footer: Footer[];
  /** The footer while the meter is locked. */
  footerLocked: boolean;
  /** Of the footer, on the compact bar. */
  footerSmall: Footer[];
  /** Shrinks to one bar out of fights. */
  compact: boolean;
  /** Is one bar, in fights too. */
  small: boolean;
  /** Lets every click through to the game, but for its buttons. */
  locked: boolean;
  buttons: Button[];
  buttonsLocked: Button[];
  /** You first, and you when there is no fight. */
  top: boolean;
  always: boolean;
  /** How far it is to the next place, who is in a burst, who is dead, and your last casts. */
  gap: boolean;
  burst: boolean;
  dead: boolean;
  casts: boolean;
  /** What others' buffs added, as a pale part of the bar. */
  buffShare: boolean;
}

/** How the meter looks. An empty colour is House's own. */
export interface Look {
  theme: (typeof THEMES)[number];
  background: string;
  width: number;
  height: number;
  font: (typeof FONTS)[number];
  size: number;
  outline: (typeof OUTLINES)[number];
  thin: boolean;
  /** How strong the class mark behind a row is. */
  mark: number;
  /** Darkness behind it while locked. */
  shade: number;
  /** Stronger text and bars while locked. */
  strong: boolean;
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
  voice: { on: boolean; volume: number; name: string; lead: number; mute: boolean };
  bosses: Record<string, BossPlan>;
  hotkeys: Record<Action, string>;
  overlay: { on: boolean; onlyInGame: boolean; opacity: number; hideEmpty: boolean; /** Of all of them. */ size: number; snap: boolean };
  meter: Meter;
  look: Look;
  /** Colours of your own, by what they say and by class. */
  tones: Partial<Record<Tone, string>>;
  colors: Partial<Record<Exclude<Job, "">, string>>;
  /** When a fight is over, in seconds without a hit, and what is shown of which. */
  fights: { end: number; bossEnd: number; after: "keep" | "clear"; only: (typeof ONLY)[number]; keep: number };
  training: { auto: boolean; seconds: number };
  party: { columns: 1 | 2; width: number; height: number; icons: "on" | "beside" | "off"; most: number; order: "game" | "role" | "name"; you: boolean; health: "percent" | "number" | "both" | "off"; mark: boolean; power: boolean; low: number };
  cooldowns: { ready: boolean; dim: number; size: number };
  buffs: { as: "tiles" | "bars"; items: "with" | "apart" | "off"; skip: Named[] };
  control: { look: "card" | "ring" | "text"; /** Kinds left out. */ skip: string[]; least: number; by: boolean };
  pingAs: "round" | "oneway";
  /** Fades out of fights, and moves a little now and then. */
  oled: boolean;
  /** Names and Combat Power are hidden everywhere. */
  discreet: boolean;
  /** The session is recorded, for a bug report. */
  record: boolean;
  /** The first start is done. */
  started: boolean;
  places: Record<string, Place>;
  /** When each overlay may show. One that is not here always may. */
  rules: Record<string, Rule>;
  auras: AuraRule[];
  /** Effects to have on before a pull. The number 0 is any food or other item. */
  ready: Named[];
  /** Skills left off the action bars. */
  skip: number[];
  resources: Resource[];
  odyleRun: (typeof ODYLE_RUN)[number];
  odyle: { parts: (typeof ODYLE)[number][]; /** A membership: it may grow further. */ member: boolean; warn: boolean; pop: boolean; ring: boolean; place: "bottom" | "top" | "out" };
  /** Skills and effects with the game's pictures, when there are some. */
  pictures: boolean;
  against: Record<(typeof AGAINST)[number], boolean>;
  second: Second;
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
  voice: { on: false, volume: 0.8, name: "", lead: 5, mute: false },
  bosses: {},
  hotkeys: {
    overlay: "Ctrl+Alt+F9", edit: "Ctrl+Alt+F10", reset: "Ctrl+Alt+F11", view: "Ctrl+Alt+F12", quick: "Ctrl+Alt+F8",
    // Empty, so that none takes a key you use.
    compact: "", lock: "", peek: "", discreet: "", history: "", details: "", settings: "", buffs: "", actions: "", second: "",
  },
  overlay: { on: true, onlyInGame: true, opacity: 0.62, hideEmpty: true, size: 1, snap: true },
  meter: {
    style: "bar", rows: 8, left: "share", right: "", full: false, icons: true, corner: "power", corners: "all", head: true, boss: true, clock: true, ghost: false,
    hideNames: false, view: "damage", edge: "bottom", footer: ["ping", "odyle", "entries"], footerLocked: true, footerSmall: ["ping", "odyle"],
    compact: true, small: false, locked: true, buttons: ["view", "clear", "history", "compact", "lock", "menu"], buttonsLocked: [],
    top: false, always: false, gap: true, burst: true, dead: true, casts: false, buffShare: false,
  },
  look: { theme: "glass", background: "", width: 280, height: 25, font: "house", size: 1, outline: "", thin: false, mark: 0, shade: 0, strong: false },
  tones: {},
  colors: {},
  fights: { end: 30, bossEnd: 45, after: "keep", only: "", keep: 0 },
  training: { auto: true, seconds: 60 },
  party: { columns: 1, width: 260, height: 32, icons: "on", most: 4, order: "game", you: true, health: "percent", mark: true, power: false, low: 25 },
  cooldowns: { ready: true, dim: 0.5, size: 36 },
  buffs: { as: "tiles", items: "with", skip: [] },
  control: { look: "card", skip: [], least: 0, by: true },
  pingAs: "round",
  oled: false,
  discreet: false,
  record: false,
  started: false,
  places: {},
  rules: {},
  auras: [],
  ready: [],
  skip: [],
  resources: [],
  odyleRun: 40,
  odyle: { parts: ["energy", "charged", "runs"], member: false, warn: true, pop: true, ring: true, place: "bottom" },
  pictures: true,
  against: { rival: true, time: true, wipes: true, grade: true, burst: true, tip: true, streak: true, art: true },
  second: { parts: ["meter", "boss", "curve", "splits", "timers", "resources", "party", "buffs"], size: 1.1, full: false, open: false },
  alerts: {
    low: { on: false, banner: true, sound: "alarm", say: false, value: 30, volume: 1 },
    ally: { on: false, banner: true, sound: "drop", say: false, value: 25, volume: 1 },
    died: { on: false, banner: true, sound: "fall", say: false, value: 0, volume: 1 },
    fight: { on: false, banner: false, sound: "chime", say: false, value: 0, volume: 1 },
    held: { on: false, banner: false, sound: "drop", say: false, value: 0, volume: 1 },
    enrage: { on: false, banner: true, sound: "alarm", say: false, value: 0, volume: 1 },
    kill: { on: false, banner: true, sound: "rise", say: false, value: 0, volume: 1 },
    slain: { on: false, banner: false, sound: "fall", say: false, value: 0, volume: 1 },
    best: { on: true, banner: true, sound: "rise", say: false, value: 0, volume: 1 },
    record: { on: true, banner: true, sound: "chime", say: false, value: 0, volume: 0.6 },
  },
  startup: false,
  sleep: true,
};

const object = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const number = (v: unknown, least: number, most: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(most, Math.max(least, v)) : fallback;
const one = <T>(v: unknown, all: readonly T[], fallback: T) => (all.includes(v as T) ? (v as T) : fallback);
/** Those of `all` that are named, in the order of `all`. One that was never set is the default. */
const some = <T>(v: unknown, all: readonly T[], fallback: readonly T[]): T[] => (Array.isArray(v) ? all.filter((x) => v.includes(x)) : [...fallback]);
const color = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : "");
const colors = <K extends string>(v: unknown, all: readonly K[]): Partial<Record<K, string>> => {
  const o = object(v);
  return Object.fromEntries(all.filter((k) => color(o[k])).map((k) => [k, color(o[k])])) as Partial<Record<K, string>>;
};
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
  own: flag(v.own, false),
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
  const [look, fights, training, party, cooldowns, buffs, control, odyle] = [s.look, s.fights, s.training, s.party, s.cooldowns, s.buffs, s.control, s.odyle].map(object);
  const [against, second] = [s.against, s.second].map(object);
  const at = numbers(second.at, -100_000, 100_000, 4);
  const m = d.meter;
  return {
    version: VERSION,
    live: flag(s.live, d.live),
    mode: one(s.mode, MODES, d.mode),
    updateMs: number(s.updateMs, 50, 1000, d.updateMs),
    fps: one(s.fps as number, FPS as readonly number[], d.fps),
    theme: one(s.theme, ["dark", "light", "auto"] as const, d.theme),
    accent: color(s.accent) || one(s.accent as string, [...ACCENTS, "class"] as readonly string[], d.accent),
    safeColors: flag(s.safeColors, d.safeColors),
    text: one(s.text as number, TEXTS as readonly number[], d.text),
    voice: {
      on: flag(voice.on, d.voice.on),
      volume: number(voice.volume, 0, 1, d.voice.volume),
      name: typeof voice.name === "string" ? voice.name : "",
      lead: number(voice.lead, 2, 15, d.voice.lead),
      mute: flag(voice.mute, d.voice.mute),
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
      size: number(overlay.size, 0.6, 1.6, d.overlay.size),
      snap: flag(overlay.snap, d.overlay.snap),
    },
    meter: {
      style: one(meter.style, STYLES, m.style),
      rows: Math.round(number(meter.rows, 1, 24, m.rows)),
      left: one(meter.left as Meter["left"], SIDES, m.left),
      right: one(meter.right as Meter["right"], SIDES, m.right),
      full: flag(meter.full, m.full),
      icons: flag(meter.icons, m.icons),
      corner: one(meter.corner as Meter["corner"], CORNERS, m.corner),
      corners: one(meter.corners, ["you", "all"] as const, m.corners),
      head: flag(meter.head, m.head),
      boss: flag(meter.boss, m.boss),
      clock: flag(meter.clock, m.clock),
      ghost: flag(meter.ghost, m.ghost),
      hideNames: flag(meter.hideNames, m.hideNames),
      view: one(meter.view, VIEWS, m.view),
      edge: one(meter.edge, ["top", "bottom"] as const, m.edge),
      footer: some(meter.footer, FOOTER, m.footer),
      footerLocked: flag(meter.footerLocked, m.footerLocked),
      footerSmall: some(meter.footerSmall, FOOTER, m.footerSmall),
      compact: flag(meter.compact, m.compact),
      small: flag(meter.small, m.small),
      locked: flag(meter.locked, m.locked),
      buttons: some(meter.buttons, BUTTONS, m.buttons),
      buttonsLocked: some(meter.buttonsLocked, BUTTONS, m.buttonsLocked),
      top: flag(meter.top, m.top),
      always: flag(meter.always, m.always),
      gap: flag(meter.gap, m.gap),
      burst: flag(meter.burst, m.burst),
      dead: flag(meter.dead, m.dead),
      casts: flag(meter.casts, m.casts),
      buffShare: flag(meter.buffShare, m.buffShare),
    },
    look: {
      theme: one(look.theme as Look["theme"], THEMES, d.look.theme),
      background: color(look.background),
      width: Math.round(number(look.width, 220, 460, d.look.width)),
      height: Math.round(number(look.height, 18, 40, d.look.height)),
      font: one(look.font as Look["font"], FONTS, d.look.font),
      size: number(look.size, 0.8, 1.4, d.look.size),
      outline: one(look.outline as Look["outline"], OUTLINES, d.look.outline),
      thin: flag(look.thin, d.look.thin),
      mark: number(look.mark, 0, 0.6, d.look.mark),
      shade: number(look.shade, 0, 1, d.look.shade),
      strong: flag(look.strong, d.look.strong),
    },
    tones: colors(s.tones, TONES),
    colors: colors(s.colors, JOBS.filter((j) => j !== "")),
    fights: {
      end: number(fights.end, 5, 60, d.fights.end),
      bossEnd: number(fights.bossEnd, 5, 60, d.fights.bossEnd),
      after: one(fights.after, ["keep", "clear"] as const, d.fights.after),
      only: one(fights.only as Settings["fights"]["only"], ONLY, d.fights.only),
      keep: one(fights.keep as number, KEEP as readonly number[], d.fights.keep),
    },
    training: { auto: flag(training.auto, d.training.auto), seconds: one(training.seconds as number, RUNS as readonly number[], d.training.seconds) },
    party: {
      columns: one(party.columns as 1 | 2, [1, 2] as const, d.party.columns),
      width: Math.round(number(party.width, 160, 420, d.party.width)),
      height: Math.round(number(party.height, 22, 56, d.party.height)),
      icons: one(party.icons, ["on", "beside", "off"] as const, d.party.icons),
      most: Math.round(number(party.most, 1, 8, d.party.most)),
      order: one(party.order, ["game", "role", "name"] as const, d.party.order),
      you: flag(party.you, d.party.you),
      health: one(party.health, ["percent", "number", "both", "off"] as const, d.party.health),
      mark: flag(party.mark, d.party.mark),
      power: flag(party.power, d.party.power),
      low: number(party.low, 0, 90, d.party.low),
    },
    cooldowns: { ready: flag(cooldowns.ready, d.cooldowns.ready), dim: number(cooldowns.dim, 0.2, 1, d.cooldowns.dim), size: Math.round(number(cooldowns.size, 24, 56, d.cooldowns.size)) },
    buffs: { as: one(buffs.as, ["tiles", "bars"] as const, d.buffs.as), items: one(buffs.items, ["with", "apart", "off"] as const, d.buffs.items), skip: list(buffs.skip, 200).map(named) },
    control: {
      look: one(control.look, ["card", "ring", "text"] as const, d.control.look),
      skip: (Array.isArray(control.skip) ? control.skip : []).filter((k): k is string => typeof k === "string").slice(0, 40),
      least: number(control.least, 0, 3, d.control.least),
      by: flag(control.by, d.control.by),
    },
    pingAs: one(s.pingAs, ["round", "oneway"] as const, d.pingAs),
    oled: flag(s.oled, d.oled),
    discreet: flag(s.discreet, d.discreet),
    record: flag(s.record, d.record),
    started: flag(s.started, d.started),
    // Each overlay reads its own place, with its own default.
    places: object(s.places) as Record<string, Place>,
    rules: Object.fromEntries(Object.entries(object(s.rules)).map(([id, r]) => [id, rule(r)])),
    auras: list(s.auras, 60).map(aura),
    ready: list(s.ready, 40).map(named),
    skip: numbers(s.skip, 1, 2 ** 31, 200),
    resources: list(s.resources, 200).map((r) => ({ id: Math.round(number(r.id, 0, 2 ** 32, 0)), name: text(r.name, 40), kind: one<Resource["kind"]>(r.kind, ["", ...KINDS], ""), show: flag(r.show, false) }))
      .filter((r) => r.id > 0 && (r.name || r.kind || r.show)),
    odyleRun: one(s.odyleRun as Settings["odyleRun"], ODYLE_RUN, d.odyleRun),
    odyle: {
      parts: some(odyle.parts, ODYLE, d.odyle.parts),
      member: flag(odyle.member, d.odyle.member),
      warn: flag(odyle.warn, d.odyle.warn),
      pop: flag(odyle.pop, d.odyle.pop),
      ring: flag(odyle.ring, d.odyle.ring),
      place: one(odyle.place, ["bottom", "top", "out"] as const, d.odyle.place),
    },
    pictures: flag(s.pictures, d.pictures),
    against: Object.fromEntries(AGAINST.map((a) => [a, flag(against[a], d.against[a])])) as Settings["against"],
    second: {
      parts: some(second.parts, SECOND, d.second.parts),
      size: number(second.size, 0.7, 2, d.second.size),
      ...(at.length === 4 && at[2] > 0 && at[3] > 0 && { at }),
      full: flag(second.full, d.second.full),
      open: flag(second.open, d.second.open),
    },
    alerts: Object.fromEntries(
      ALERTS.map((id) => {
        const a = object(alerts[id]);
        const f = d.alerts[id];
        return [id, { on: flag(a.on, f.on), banner: flag(a.banner, f.banner), value: number(a.value, 0, 100, f.value), volume: number(a.volume, 0, 1, f.volume), ...signal(a, f) }];
      }),
    ) as Settings["alerts"],
    startup: flag(s.startup, d.startup),
    sleep: flag(s.sleep, d.sleep),
  };
}

/** The easing that moves a bar over `ms` at `fps` frames a second. */
export const barEase = (fps: number, ms: number) =>
  fps === 0 ? "linear" : `steps(${Math.max(1, Math.round((fps * ms) / 1000))}, jump-end)`;
