import type { Aura, Fight, Near } from "../../live/types.ts";
import type { Alert, AlertId, BossPlan, Mechanic } from "../../store/settings.ts";
import { called, CONTROL, held, same } from "../effects/logic.ts";
import { dead, share, who } from "../frames/logic.ts";

export const ALERT_NAMES: Record<AlertId, { name: string; about: string; value?: string }> = {
  low: { name: "Your health is low", about: "Once each time it falls below.", value: "Below" },
  ally: { name: "Someone in the party is low", about: "Once each time they fall below.", value: "Below" },
  died: { name: "Someone in the party died", about: "And you." },
  fight: { name: "A fight began", about: "Your first hit, or the first on you." },
  held: { name: "You lose control", about: "Stunned, held, asleep and the like." },
  enrage: { name: "The target enrages", about: "When the game puts that effect on it." },
  kill: { name: "You killed a player", about: "With how many in a row." },
  slain: { name: "A player killed you", about: "Your streak ends." },
};

/** What of now matters to an alert, small enough to hold against the next. */
export interface Look {
  low: boolean;
  fighting: boolean;
  held: string;
  enraged: boolean;
  /** Of the party, by key. */
  lowAllies: ReadonlySet<string>;
  alive: ReadonlySet<string>;
  fallen: ReadonlySet<string>;
}

/** Health has to come back this far above the mark before the same alert comes again. */
const BACK = 10;

export function look(near: Near, alerts: Pick<Record<AlertId, Alert>, "low" | "ally">, before?: Look): Look {
  const under = (u: { hp: number; maxHp: number }, mark: number, was: boolean) => {
    const part = share(u);
    return part !== undefined && part > 0 && part * 100 <= mark + (was ? BACK : 0);
  };
  const keys = (units: Near["party"]) => new Set(units.map((u) => u.key));
  const others = near.party.filter((u) => !u.you);
  return {
    low: !!near.you && under(near.you, alerts.low.value, before?.low ?? false),
    fighting: near.fighting,
    held: held(near.you?.auras ?? [])?.tag ?? "",
    enraged: near.target?.auras.some((a) => a.tag === "enrage") ?? false,
    lowAllies: keys(others.filter((u) => under(u, alerts.ally.value, before?.lowAllies.has(u.key) ?? false))),
    alive: keys(near.party.filter((u) => u.hp > 0)),
    fallen: keys(near.party.filter(dead)),
  };
}

export interface Raised {
  id: AlertId;
  text: string;
}

/** What to call attention to between two looks. `name` gives a party member's. */
export function raised(before: Look, now: Look, near: Pick<Near, "party">, hide: boolean): Raised[] {
  const all: Raised[] = [];
  const name = (key: string) => {
    const at = near.party.findIndex((u) => u.key === key);
    return at < 0 ? "Someone" : who(near.party[at], at, hide);
  };
  if (now.low && !before.low) all.push({ id: "low", text: "Low health" });
  for (const key of now.lowAllies) if (!before.lowAllies.has(key)) all.push({ id: "ally", text: `${name(key)} is low` });
  for (const key of now.fallen) if (before.alive.has(key)) all.push({ id: "died", text: `${name(key)} died` });
  if (now.fighting && !before.fighting) all.push({ id: "fight", text: "Fight" });
  if (now.held && !before.held) all.push({ id: "held", text: CONTROL[now.held] });
  if (now.enraged && !before.enraged) all.push({ id: "enrage", text: "Enraged" });
  return all;
}

export const streakText = (streak: number) => (streak > 1 ? `${streak} in a row` : "Kill");

/** A mechanic's words, for your class. */
const words = (m: Mechanic) => (m.note ? `${m.name}: ${m.note}` : m.name);
const mine = (m: Mechanic, job: string) => !m.job || !job || m.job === job;

export interface Call {
  text: string;
  say: boolean;
}

/** What to call out as a monster's skill lands. */
export const onBlow = (plan: BossPlan, h: { skill: number; name: string }, job: string): Call[] =>
  plan.mechanics.filter((m) => !m.effect && mine(m, job) && same(m, { id: h.skill, name: h.name })).map((m) => ({ text: words(m), say: m.say }));

/** And as an effect comes on the target. `seen` are the keys of those that were on it. */
export const onEffects = (plan: BossPlan, auras: readonly Aura[], seen: ReadonlySet<string>, job: string): Call[] =>
  auras
    .filter((a) => !seen.has(a.key))
    .flatMap((a) => plan.mechanics.filter((m) => m.effect && mine(m, job) && same(m, a)).map((m) => ({ text: words(m), say: m.say })));

/** And ahead of one whose time was learned. */
export function ahead(plan: BossPlan, before: number, now: number, lead: number, job: string): Call[] {
  if (now < before) return [];
  return plan.timers.flatMap((t) =>
    t.at.some((at) => before < (at - lead) * 1000 && now >= (at - lead) * 1000)
      ? plan.mechanics.filter((m) => !m.effect && mine(m, job) && same(m, { id: t.skill, name: t.name })).map((m) => ({ text: `In ${lead}: ${words(m)}`, say: m.say }))
      : [],
  );
}

/** The time the target cannot be hurt, when that is so. */
export const safe = (auras: readonly Aura[]) => auras.filter((a) => a.tag === "safe").sort((a, b) => b.end - a.end)[0];

/** Notes show this long into a fight. */
const NOTES = 20_000;
export const notes = (plan: BossPlan, fight: Pick<Fight, "ms" | "rows" | "target">, fighting: boolean) =>
  fighting && fight.target.boss && fight.rows.length && fight.ms < NOTES ? plan.notes : "";

/** Effects that a boss had on itself, to choose from. Known only of this session's fights. */
export function bossEffects(pulls: readonly { buffs?: { id: number; name: string; on: number; by: number; passive: boolean }[]; you: { id: number } | null; rows?: { id: number }[] }[]): { id: number; name: string }[] {
  const all = new Map<string, { id: number; name: string }>();
  for (const p of pulls) {
    for (const b of p.buffs ?? []) {
      const player = (id: number) => id === p.you?.id || !!p.rows?.some((r) => r.id === id);
      if (!player(b.on) && b.by === b.on) all.set(called(b), { id: b.id, name: b.name });
    }
  }
  return [...all.values()];
}
