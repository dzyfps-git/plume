import type { Fight, Row, Skill } from "../../live/types";

/** The rows that fit. Yours is always one of them, in the last place if it would fall off. */
export function shown(rows: readonly Row[], most: number): { row: Row; rank: number }[] {
  const ranked = rows.map((row, i) => ({ row, rank: i + 1 }));
  const top = ranked.slice(0, most);
  const you = ranked.find(({ row }) => row.you);
  if (you && you.rank > most) top[top.length - 1] = you;
  return top;
}

/** How long a bar is: its share of the biggest. */
export const length = (row: Pick<Row, "damage">, rows: readonly Pick<Row, "damage">[]) =>
  rows.length && rows[0].damage > 0 ? row.damage / rows[0].damage : 0;

export const partyDps = (fight: Pick<Fight, "total" | "ms">) => (fight.ms >= 1000 ? fight.total / (fight.ms / 1000) : fight.total);

export const label = (row: Pick<Row, "name" | "you">, hide: boolean, rank: number) =>
  row.you ? row.name || "You" : hide || !row.name ? `Player ${rank}` : row.name;

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
