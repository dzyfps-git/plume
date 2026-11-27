import type { Job, Near, Saved } from "../../live/types.ts";
import type { AuraRule, Named } from "../../store/settings.ts";
import { cooling, type Known } from "../actions/logic.ts";
import { called, effects, same } from "../effects/logic.ts";
import { dead, share } from "../frames/logic.ts";
import { starts } from "../report/logic.ts";

export const KIND_NAMES: Record<AuraRule["kind"], string> = {
  on: "An effect is on you",
  missing: "An effect is missing on you",
  target: "Your effect is on the target",
  untarget: "Your effect is missing on the target",
  ready: "A skill is ready, about",
  low: "Your health is low",
  party: "Your buff is missing on some of the party",
};

/** What the number of an aura means. Nothing when it has no use. */
export const VALUE_NAMES: Partial<Record<AuraRule["kind"], { name: string; about: string; least: number; most: number; unit: string }>> = {
  on: { name: "Only its last seconds", about: "0 shows all of it.", least: 0, most: 60, unit: " s" },
  target: { name: "Only its last seconds", about: "0 shows all of it.", least: 0, most: 60, unit: " s" },
  ready: { name: "Seconds before it is ready", about: "0 waits until it is.", least: 0, most: 30, unit: " s" },
  low: { name: "Below", about: "Of your health.", least: 5, most: 95, unit: "%" },
};

export interface State {
  rule: AuraRule;
  name: string;
  /** 0 when there is no time to it. */
  start: number;
  end: number;
  stacks: number;
  text: string;
}

const name = (rule: AuraRule) => (rule.kind === "low" ? "Low health" : called(rule.of));
/** What the settings call it. */
export const ruleName = (a: AuraRule) => (a.kind === "low" || a.of.id || a.of.name ? name(a) : "Nothing chosen yet");
/** Where its own place is kept. */
export const placeOf = (key: string) => `aura:${key}`;

/** The auras that show now. */
export function states(
  rules: readonly AuraRule[],
  near: Pick<Near, "you" | "party" | "target" | "fighting">,
  skills: readonly Known[],
  casts: ReadonlyMap<number, number>,
  now: number,
): State[] {
  const mine = near.you?.auras ?? [];
  return rules.flatMap((rule) => {
    if (!rule.on || (rule.fight && !near.fighting) || !near.you) return [];
    const show = (more: Partial<State> = {}): State[] => [{ rule, name: name(rule), start: 0, end: 0, stacks: 0, text: "", ...more }];
    const timed = (a: { start: number; end: number; stacks: number } | undefined) => {
      if (!a || (a.end && a.end <= now)) return [];
      const late = rule.value > 0 && (!a.end || a.end - now > rule.value * 1000);
      return late ? [] : show({ start: a.start, end: a.end, stacks: a.stacks });
    };
    const on = () => mine.find((a) => same(rule.of, a));
    const onTarget = () => near.target?.auras.find((a) => a.yours && same(rule.of, a));
    if (rule.kind === "on") return timed(on());
    if (rule.kind === "missing") return on() ? [] : show({ text: "missing" });
    if (rule.kind === "target") return timed(onTarget());
    if (rule.kind === "untarget") return near.target && !onTarget() ? show({ text: "missing" }) : [];
    if (rule.kind === "low") {
      const part = share(near.you);
      return part !== undefined && !dead(near.you) && part * 100 <= rule.value ? show({ text: `${Math.round(part * 100)}%` }) : [];
    }
    if (rule.kind === "party") {
      const up = near.party.filter((u) => !dead(u));
      const have = up.filter((u) => effects(u, near).some((a) => a.yours && same(rule.of, a))).length;
      return up.length > 1 && have < up.length ? show({ text: `${have} of ${up.length}` }) : [];
    }
    const skill = skills.find((s) => s.skill === rule.of.id || s.name === rule.of.name);
    if (!skill) return [];
    const wait = cooling(skill, casts.get(skill.skill), now);
    if (!wait) return show({ text: "ready" });
    return wait.end - now <= rule.value * 1000 ? show({ start: wait.start, end: wait.end }) : [];
  });
}

/** Those that came on between two looks. */
export const fresh = (before: ReadonlySet<string>, now: readonly State[]) => now.filter((s) => !before.has(s.rule.key));

/** Every effect of your own fights, the ones that were up the most first. */
export function effectsOf(fights: readonly Saved[]): (Named & { onYou: boolean; yours: boolean; up: number; starts: number; ms: number })[] {
  const all = new Map<string, Named & { onYou: boolean; yours: boolean; up: number; starts: number; ms: number }>();
  for (const f of fights) {
    for (const b of f.buffs ?? []) {
      const you = f.you?.id;
      const [onYou, yours] = [b.on === you, b.by === you];
      if (b.passive || (!onYou && !yours)) continue;
      // Yours on yourself, yours on another, and another's on you are three things.
      const key = `${b.name || b.id} ${onYou} ${yours}`;
      const e = all.get(key) ?? { id: b.id, name: b.name, onYou, yours, up: 0, starts: 0, ms: 0 };
      all.set(key, e);
      e.up += b.up;
      e.starts += starts(b);
      e.ms += f.ms;
    }
  }
  return [...all.values()].sort((a, b) => b.up - a.up);
}

export const blank = (key: string, edit: Partial<AuraRule> = {}): AuraRule => ({
  key, kind: "on", of: { id: 0, name: "" }, value: 0, look: "icon", glow: false, fight: true, own: false, on: true, sound: "", say: false, ...edit,
});

/** Auras to start from: what you keep up, what you put on the target, and your longest cooldowns. */
export function starter(fights: readonly Saved[], skills: readonly Known[], key: (n: number) => string): AuraRule[] {
  const all = effectsOf(fights);
  const of = (e: Named): Named => ({ id: e.id, name: e.name });
  // Up all the time it says nothing, and up once it was luck.
  const kept = all.filter((e) => e.yours && e.onYou && e.starts > 1 && e.up < e.ms * 0.97).slice(0, 4);
  const put = all.filter((e) => e.yours && !e.onYou && e.starts > 1).slice(0, 3);
  const long = skills.slice(0, 4);
  return [
    ...kept.map((e) => ({ kind: "on" as const, of: of(e), look: "icon" as const })),
    ...put.map((e) => ({ kind: "target" as const, of: of(e), look: "bar" as const })),
    ...long.map((s) => ({ kind: "ready" as const, of: { id: s.skill, name: s.name }, look: "icon" as const, glow: true })),
  ].map((edit, n) => blank(key(n), edit));
}

const on = (id: number, name: string): Partial<AuraRule> => ({ kind: "on", of: { id, name } });
const target = (id: number, name: string): Partial<AuraRule> => ({ kind: "target", of: { id, name }, look: "bar" });
const ready = (id: number, name: string): Partial<AuraRule> => ({ kind: "ready", of: { id, name }, glow: true });

/** Ready-made sets, by class. A skill you do not have, or whose cooldown is not learned yet, shows nothing. */
export const SETS: Partial<Record<Job, readonly Partial<AuraRule>[]>> = {
  assassin: [
    on(131_500_001, "Frenzied Accord"), on(133_900_001, "Swift Contract"), on(133_700_001, "Evasion Contract"), on(130_800_001, "Evasion Stance"),
    target(137_300_071, "Poison"),
    ready(13_350_000, "Heart Gore"), ready(13_130_000, "Insignia Explosion"), ready(13_220_000, "Shadow Fall"), ready(13_310_000, "Illusive Clone"),
    ready(13_300_000, "Triniel's Dagger"),
    { kind: "low", value: 35, look: "text", glow: true },
  ],
};
