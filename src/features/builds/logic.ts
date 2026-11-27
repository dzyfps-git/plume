// Builds of your own on the Daevanion boards. Each board is a grid of 15 by 15; a node is taken from the middle outwards,
// next to one already taken. Which nodes truly touch in the game is not in the data: side by side is assumed.

/** Place 1 to 225, grade, and a stat's name or a skill's number. The middle has grade "None". */
export type Node = [place: number, grade: string, gives: string | number | ""];

export interface Board {
  id: number;
  nodes: Node[];
}

export interface BoardFile {
  made: string;
  /** By class name: Gladiator, Templar and so on. */
  boards: Record<string, Board[]>;
}

export interface Build {
  name: string;
  job: string;
  /** Places taken, by board. The middle is never kept: it is always taken. */
  taken: Record<string, number[]>;
}

export const SIDE = 15;
export const rowOf = (place: number) => Math.floor((place - 1) / SIDE);
export const columnOf = (place: number) => (place - 1) % SIDE;
const around = (place: number) =>
  [columnOf(place) > 0 ? place - 1 : 0, columnOf(place) < SIDE - 1 ? place + 1 : 0, place - SIDE, place + SIDE].filter((p) => p >= 1 && p <= SIDE * SIDE);

export const middle = (b: Board) => b.nodes.find((n) => n[1] === "None")?.[0] ?? 113;

/** It can be taken: it is on the board, not taken, and next to the middle or to one taken. */
export function canTake(b: Board, taken: readonly number[], place: number): boolean {
  if (!b.nodes.some((n) => n[0] === place) || place === middle(b) || taken.includes(place)) return false;
  const have = new Set([middle(b), ...taken]);
  return around(place).some((p) => have.has(p));
}

/** Letting one go lets go of all that hung on it. */
export function letGo(b: Board, taken: readonly number[], place: number): number[] {
  const left = new Set(taken.filter((p) => p !== place));
  const reached = new Set<number>();
  const next = [middle(b)];
  while (next.length) {
    for (const p of around(next.pop()!)) {
      if (left.has(p) && !reached.has(p)) {
        reached.add(p);
        next.push(p);
      }
    }
  }
  return taken.filter((p) => reached.has(p));
}

/** What the taken nodes give over all boards: each stat with how many nodes, and each skill once. */
export function sums(boards: readonly Board[], build: Build): { stats: [name: string, nodes: number][]; skills: number[] } {
  const stats = new Map<string, number>();
  const skills: number[] = [];
  for (const b of boards) {
    for (const place of build.taken[b.id] ?? []) {
      const gives = b.nodes.find((n) => n[0] === place)?.[2];
      if (typeof gives === "number") skills.push(gives);
      else if (gives) stats.set(gives, (stats.get(gives) ?? 0) + 1);
    }
  }
  return { stats: [...stats].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), skills };
}

/** "CriticalHitResist" as "Critical hit resist", "PvEAttack" as "PvE attack", "MaxHP" as "Max HP". */
export function statWords(stat: string): string {
  const [, side = "", rest = ""] = /^(PvE|PvP)?(.*)$/.exec(stat) ?? [];
  const words = rest.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ").map((w) => (/^[HM]P$/.test(w) ? w : w.toLowerCase()));
  const said = [side, ...words].filter(Boolean).join(" ");
  return side ? said : said.charAt(0).toUpperCase() + said.slice(1);
}
