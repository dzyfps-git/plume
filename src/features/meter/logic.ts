import type { Fight, Row, Skill } from "../../live/types.ts";
import type { View } from "../../store/settings.ts";

export const VIEW_NAMES: Record<View, string> = {
  damage: "Damage",
  rdps: "Damage with buffs counted",
  healing: "Healing",
  taken: "Damage taken",
  hits: "Hits a second",
};

export interface Ranked {
  row: Row;
  /** All of it, and each second. */
  total: number;
  rate: number;
  share: number;
}

/** Rows by what the meter shows, the most first. Nobody's place but damage's changes the party's total. */
export function ranked(fight: Pick<Fight, "rows" | "ms">, view: View): Ranked[] {
  const seconds = Math.max(1, fight.ms / 1000);
  const of: Record<View, (r: Row) => number> = {
    damage: (r) => r.damage,
    rdps: (r) => r.damage - r.got + r.given,
    healing: (r) => r.healing,
    taken: (r) => r.taken,
    hits: (r) => r.hits,
  };
  const rows = fight.rows.map((row) => ({ row, total: of[view](row) }));
  const sum = rows.reduce((all, r) => all + r.total, 0);
  return rows
    // Only damage has a place for those who did none.
    .filter((r) => view === "damage" || (r.total > 0 && !(r.row.others && view !== "rdps")))
    .map(({ row, total }) => ({
      row, total,
      // The engine's own number, so that the meter and the game agree.
      rate: view === "damage" ? row.dps : total / seconds,
      share: sum > 0 ? (total / sum) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total || a.row.id - b.row.id);
}

/** The rows that fit. Yours is always one of them, in the last place if it would fall off. */
export function shown<T extends { row: Pick<Row, "you"> }>(rows: readonly T[], most: number): (T & { rank: number })[] {
  const all = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const top = all.slice(0, most);
  const you = all.find(({ row }) => row.you);
  if (you && you.rank > most) top[top.length - 1] = you;
  return top;
}

/** How long a bar is: its share of the biggest. */
export const length = (row: Pick<Row, "damage">, rows: readonly Pick<Row, "damage">[]) =>
  rows.length && rows[0].damage > 0 ? row.damage / rows[0].damage : 0;

export const partyDps = (fight: Pick<Fight, "total" | "ms">) => (fight.ms >= 1000 ? fight.total / (fight.ms / 1000) : fight.total);

export const label = (row: Pick<Row, "name" | "you"> & { others?: boolean }, hide: boolean, rank: number) =>
  row.others ? "Everyone else, about" : row.you ? row.name || "You" : hide || !row.name ? `Player ${rank}` : row.name;

export interface SkillLine extends Skill {
  share: number;
  average: number;
  crit: number;
  back: number;
}

/** Skills with the numbers worked out from them. Direct hits and ticks of one skill stay apart. */
export function lines(skills: readonly Skill[]): SkillLine[] {
  const total = skills.reduce((sum, s) => sum + s.damage, 0);
  const part = (n: number, s: Skill) => (s.hits > 0 ? n / s.hits : 0);
  return skills.map((s) => ({
    ...s,
    share: total > 0 ? s.damage / total : 0,
    average: part(s.damage, s),
    crit: part(s.crits, s),
    back: part(s.backs, s),
  }));
}
