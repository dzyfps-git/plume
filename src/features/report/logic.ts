// What a kept fight says about how it was played. Everything here is worked out from your own hits.
import { FLAG, type Buff, type Entry, type Saved } from "../../live/types.ts";
import { clock, short } from "../../ui/format.ts";

/** Hits of one skill this close together are one cast of it: the game says hits, not casts. */
const SAME_CAST = 600;
/** Nothing done for longer than this is a gap. */
const GAP = 2_500;
/** A skill used at least this far apart has a cooldown worth watching. */
const COOLDOWN = 5_000;
/** A follow-up comes within this. */
const CHAIN = 3_000;
const OPENER = 20;

export interface Cast {
  ms: number;
  end: number;
  skill: number;
  damage: number;
  hits: number;
}
export interface Span {
  from: number;
  to: number;
}

export const nameOf = (fight: Pick<Saved, "names">, skill: number) => fight.names?.[skill] || `Skill ${skill}`;
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const length = (spans: readonly Span[]) => sum(spans.map((s) => s.to - s.from));

/** Your casts, from your direct hits. */
export function casts(hits: readonly Entry[] = []): Cast[] {
  const all: Cast[] = [];
  const last = new Map<number, Cast>();
  for (const [ms, skill, damage, flags] of hits) {
    if (flags & FLAG.dot) continue;
    const before = last.get(skill);
    if (before && ms - before.end <= SAME_CAST) {
      before.end = ms;
      before.damage += damage;
      before.hits++;
      continue;
    }
    const cast = { ms, end: ms, skill, damage, hits: 1 };
    last.set(skill, cast);
    all.push(cast);
  }
  return all;
}

/** When you were down. */
export const down = (fight: Saved): Span[] =>
  (fight.deaths ?? []).filter((d) => d.you).map((d) => ({ from: d.ms, to: d.up < 0 ? fight.ms : d.up }));

/** When the target could not be hit: four seconds or more in which nobody's damage and not its health moved. */
export function untouchable(fight: Saved): Span[] {
  const curves = fight.rows?.map((r) => r.curve ?? []) ?? [fight.curve ?? []];
  const seconds = Math.max(0, ...curves.map((c) => c.length));
  const health = fight.health ?? [];
  // Your own hits alone prove nothing: a pause of yours is not the target's. Others' hits, or its health while others fought, do.
  // A dummy cannot be made untouchable.
  const others = fight.rows ? fight.rows.length > 1 : fight.players > 1 && health.some((h) => h >= 0);
  if (fight.dummy || !others) return [];
  const still = (s: number) => curves.every((c) => c[s] === c[s - 1]) && health[s] === health[s - 1];
  const spans: Span[] = [];
  let from = -1;
  for (let s = 1; s <= seconds; s++) {
    if (s < seconds && still(s)) {
      if (from < 0) from = s;
    } else if (from >= 0) {
      if (s - from >= 4) spans.push({ from: from * 1000, to: s * 1000 });
      from = -1;
    }
  }
  return spans;
}

const overlap = (a: Span, b: Span) => Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from));

/** What is left of a span once the times in `off` are taken out of it. */
function without(span: Span, off: readonly Span[]): Span[] {
  let left = [span];
  for (const o of off) left = left.flatMap((s) => [{ from: s.from, to: Math.min(s.to, o.from) }, { from: Math.max(s.from, o.to), to: s.to }].filter((p) => p.to > p.from));
  return left;
}

/** Times you did nothing though you could. Time you were down or the target could not be hit is not in them. */
export function gaps(fight: Saved): Span[] {
  const list = casts(fight.casts);
  const off = [...down(fight), ...untouchable(fight)];
  const all: Span[] = [];
  let end = 0;
  for (const c of list) {
    if (c.ms - end > GAP) all.push({ from: end, to: c.ms });
    end = Math.max(end, c.end);
  }
  if (list.length && fight.ms - end > GAP) all.push({ from: end, to: fight.ms });
  return all.map((g) => without(g, off)).filter((left) => length(left) > GAP).flat();
}

export interface Waited {
  skill: number;
  casts: number;
  /** How far apart your quicker casts were, taken as its cooldown. */
  usual: number;
  /** Time it lay ready, unused. */
  lost: number;
  /** Casts that would have fitted in it. */
  more: number;
}

/** Skills left waiting. The cooldown is not read from the game: it is how often you managed at your best. */
export function waited(fight: Saved): Waited[] {
  const off = [...down(fight), ...untouchable(fight)];
  const by = new Map<number, number[]>();
  for (const c of casts(fight.casts)) by.set(c.skill, [...(by.get(c.skill) ?? []), c.ms]);
  return [...by]
    .flatMap(([skill, at]) => {
      if (at.length < 3) return [];
      const apart = at.slice(1).map((t, i) => t - at[i]);
      const usual = [...apart].sort((a, b) => a - b)[Math.floor(apart.length * 0.2)];
      if (usual < COOLDOWN) return [];
      const spans = [...at.map((t, i) => ({ from: t + usual, to: at[i + 1] ?? fight.ms }))].filter((s) => s.to > s.from);
      // A second or so of waiting is only the skill before it.
      const lost = sum(spans.map((s) => Math.max(0, s.to - s.from - sum(off.map((o) => overlap(s, o))) - usual * 0.1)));
      return [{ skill, casts: at.length, usual, lost, more: Math.floor(lost / usual) }];
    })
    .sort((a, b) => b.lost / b.usual - a.lost / a.usual);
}

export interface Chain {
  first: number;
  next: number;
  kept: number;
  /** When it broke. */
  broke: number[];
}

/** Follow-ups you nearly always make, and when they did not come. */
export function chains(fight: Saved): Chain[] {
  const list = casts(fight.casts);
  const followed = new Map<number, { total: number; by: Map<number, number> }>();
  list.forEach((c, i) => {
    const f = followed.get(c.skill) ?? { total: 0, by: new Map() };
    followed.set(c.skill, f);
    f.total++;
    const next = list[i + 1];
    if (next && next.skill !== c.skill && next.ms - c.end <= CHAIN) f.by.set(next.skill, (f.by.get(next.skill) ?? 0) + 1);
  });
  return [...followed].flatMap(([first, { total, by }]) => {
    const [next, kept] = [...by].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
    if (total < 5 || kept / total < 0.7 || kept === total) return [];
    const broke = list.filter((c, i) => {
      const after = list[i + 1];
      return c.skill === first && !(after && after.skill === next && after.ms - c.end <= CHAIN);
    });
    return [{ first, next, kept, broke: broke.map((c) => c.ms) }];
  });
}

/** Buffs of your own that came without a cast: passives that go off. */
export function procs(fight: Saved): { id: number; name: string; times: number; up: number }[] {
  const used = new Set((fight.casts ?? []).map((c) => c[1]));
  const names = new Set([...used].map((skill) => fight.names?.[skill]));
  const you = fight.you?.id;
  return (fight.buffs ?? [])
    .filter((b) => b.on === you && b.by === you && !b.passive && !used.has(b.skill) && !names.has(b.name || "-"))
    .map((b) => ({ id: b.id, name: b.name, times: starts(b), up: b.up }))
    .sort((a, b) => b.up - a.up);
}

/** How often a buff came on. Spans that touch are one, with its stacks changing. */
export const starts = (b: Pick<Buff, "spans">) => b.spans.filter(([from], i) => i === 0 || from > b.spans[i - 1][1] + 50).length;

/** Casts a minute, around each second. */
export function rhythm(fight: Saved, width = 6_000): number[] {
  const at = casts(fight.casts).map((c) => c.ms);
  return Array.from({ length: Math.floor(fight.ms / 1000) + 1 }, (_, s) => {
    const [from, to] = [Math.max(0, s * 1000 - width / 2), Math.min(fight.ms, s * 1000 + width / 2)];
    return to > from ? (at.filter((t) => t >= from && t < to).length / (to - from)) * 60_000 : 0;
  });
}

/** Your damage in the first seconds. */
export const opener = (fight: Pick<Saved, "curve" | "ms">) =>
  fight.ms >= OPENER * 1000 ? fight.curve?.[OPENER - 1] : undefined;

/** Damage a second without the time the target could not be hit. */
export function activeDps(fight: Saved): number {
  const ms = fight.ms - length(untouchable(fight));
  return fight.you && ms > 0 ? fight.you.damage / (ms / 1000) : 0;
}

export interface Part extends Span {
  name: string;
  damage: number;
  dps: number;
}

/** The fight cut at health marks, high to low, with your damage in each part. A health sample is the end of its second. */
export function parts(fight: Saved, marks: readonly number[]): Part[] {
  const { health = [], curve = [], maxHp, ms } = fight;
  if (!marks.length || maxHp <= 0 || curve.length < 2 || !health.some((h) => h >= 0)) return [];
  const cuts = [...marks]
    .sort((a, b) => b - a)
    .map((mark) => ({ mark, index: health.findIndex((h) => h >= 0 && h <= (maxHp * mark) / 100) }))
    .filter((c) => c.index >= 0);
  const edges = [0, ...cuts.map((c) => Math.min(ms, (c.index + 1) * 1000)), ms];
  const at = (t: number) => (t <= 0 ? 0 : curve[Math.min(curve.length - 1, Math.max(0, Math.ceil(t / 1000) - 1))]);
  const names = [100, ...cuts.map((c) => c.mark)];
  return names.flatMap((mark, i) => {
    const [from, to] = [edges[i], edges[i + 1]];
    if (to <= from) return [];
    const damage = at(to) - at(from);
    const end = names[i + 1] ?? (fight.killed ? 0 : undefined);
    return [{ from, to, damage, dps: damage / ((to - from) / 1000), name: end === undefined ? `from ${mark}%` : `${mark}% to ${end}%` }];
  });
}

/** The target's health left, 0 to 1. Nothing when it fell or is not known. */
export function left(fight: Pick<Saved, "killed" | "maxHp" | "left" | "health">): number | undefined {
  const hp = fight.left ?? fight.health?.at(-1) ?? -1;
  return fight.killed || hp < 0 || fight.maxHp <= 0 ? undefined : Math.min(1, hp / fight.maxHp);
}

/** How a lost pull was lost, in a line. */
export function wipeLine(fight: Saved, who: (id: number) => string): string | undefined {
  if (fight.killed || fight.dummy) return undefined;
  const parts: string[] = [];
  const share = left(fight);
  if (share !== undefined) parts.push(`${(share * 100).toFixed(1)}% left`);
  const first = [...(fight.deaths ?? [])].sort((a, b) => a.ms - b.ms)[0];
  if (first) {
    const blow = first.hits.at(-1);
    // A kept fight has your deaths alone, so who fell first is not known.
    const said = fight.rows ? `${who(first.id)} died first` : "You died";
    parts.push(`${said} at ${clock(first.ms)}${blow ? `, to ${nameOf(fight, blow[1])} for ${short(blow[2])}` : ""}`);
  }
  return parts.length ? `${parts.join(". ")}.` : undefined;
}

/** Times you were hit by skills you marked as avoidable. */
export function mistakes(fight: Pick<Saved, "taken">, avoid: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const [, skill] of fight.taken ?? []) if (avoid.includes(skill)) counts.set(skill, (counts.get(skill) ?? 0) + 1);
  return counts;
}

export interface Finding {
  text: string;
  /** About how much of your damage it cost, 0 to 1. Only for sorting. */
  cost: number;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 9_950 ? 1 : 0)} s`;
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** What to do better, dearest first. `best` is your best pull of the same target. */
export function findings(fight: Saved, best?: Saved, avoid: readonly number[] = []): Finding[] {
  const all: Finding[] = [];
  const ms = Math.max(1, fight.ms);
  const add = (cost: number, text: string) => all.push({ cost, text });

  const off = down(fight);
  if (off.length) add(length(off) / ms, `You were down for ${seconds(length(off))}${off.length > 1 ? ` in ${off.length} deaths` : ""}.`);

  const still = gaps(fight);
  if (length(still) > ms * 0.02) {
    const longest = still.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a));
    add(length(still) / ms, `Nothing done for ${seconds(length(still))}, ${times(still.length)}. The longest was ${seconds(longest.to - longest.from)}, at ${clock(longest.from)}.`);
  }
  const total = Math.max(1, fight.you?.damage ?? 0);
  for (const w of waited(fight).filter((w) => w.more > 0)) {
    const damage = sum(casts(fight.casts).filter((c) => c.skill === w.skill).map((c) => c.damage)) / w.casts;
    add((w.more * damage) / total, `${nameOf(fight, w.skill)} lay ready for ${seconds(w.lost)} in all: about ${w.more} more ${w.more === 1 ? "cast" : "casts"}.`);
  }
  for (const c of chains(fight)) {
    add(0.005 * c.broke.length, `${nameOf(fight, c.next)} did not follow ${nameOf(fight, c.first)} ${times(c.broke.length)}, first at ${clock(c.broke[0])}.`);
  }
  for (const [skill, n] of mistakes(fight, avoid)) add(0.01 * n, `Hit ${times(n)} by ${nameOf(fight, skill)}, which you marked as avoidable.`);

  if (best && best.id !== fight.id) {
    const [mine, theirs] = [opener(fight), opener(best)];
    if (mine !== undefined && theirs && mine < theirs * 0.95) {
      const share = 1 - mine / theirs;
      add((share * OPENER * 1000) / ms, `Your first ${OPENER} s were ${Math.round(share * 100)}% below your best pull's.`);
    }
    const uptime = (f: Saved, id: number) => (f.buffs ?? []).filter((b) => b.id === id && b.by === f.you?.id).reduce((most, b) => Math.max(most, b.up / Math.max(1, f.ms)), 0);
    const own = new Map((best.buffs ?? []).filter((b) => b.by === best.you?.id && !b.passive && b.name).map((b) => [b.id, b.name]));
    for (const [id, name] of own) {
      const lost = uptime(best, id) - uptime(fight, id);
      if (lost > 0.1) add(lost * 0.1, `${name} was on ${Math.round(uptime(fight, id) * 100)}% of the time, ${Math.round(uptime(best, id) * 100)}% in your best pull.`);
    }
    const used = new Set((fight.casts ?? []).map((c) => c[1]));
    for (const skill of best.you?.skills ?? []) {
      const share = skill.damage / Math.max(1, best.you!.damage);
      if (share > 0.02 && !used.has(skill.code) && fight.casts?.length) add(share, `You did not use ${skill.name || nameOf(best, skill.code)}, ${Math.round(share * 100)}% of your best pull's damage.`);
    }
  }
  return all.sort((a, b) => b.cost - a.cost);
}

/** Your own result, to paste where you like. */
export function resultText(fight: Saved): string {
  const you = fight.you;
  if (!you) return "";
  const lines = [
    `${fight.target}, ${clock(fight.ms)}${fight.dummy ? "" : fight.killed ? ", killed" : ", not killed"}`,
    `${short(you.dps)} a second, ${short(you.damage)} damage, ${Math.round((you.damage / Math.max(1, fight.total)) * 100)}% of ${fight.players}`,
    ...[...(you.skills ?? [])].slice(0, 5).map((s) => `${s.name || `Skill ${s.code}`} ${Math.round((s.damage / Math.max(1, you.damage)) * 100)}%`),
  ];
  return lines.join("\n");
}
