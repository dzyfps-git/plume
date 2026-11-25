// Which of the game's pictures a skill or an effect has. The pictures are in a folder of yours; without them, letters stand in.

export interface Pictures {
  /** By the first four digits of a skill's number: its ranks share one picture. */
  skills: Record<string, string>;
  effects: Record<string, string>;
}

export interface Pictured {
  skill?: number;
  effect?: number;
}

const names = (v: unknown): Record<string, string> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string" && /^\w{1,80}$/.test(e[1])))
    : {};

export const readPictures = (v: unknown): Pictures => {
  const { skills, effects } = (v ?? {}) as Record<string, unknown>;
  return { skills: names(skills), effects: names(effects) };
};

/** An effect goes by its own picture, then by that of the skill that put it on. */
export function pictureName(all: Pictures, of: Pictured): string | undefined {
  const skill = of.skill ?? 0;
  return (of.effect && all.effects[of.effect]) || (skill >= 1e7 && skill < 1e8 ? all.skills[Math.floor(skill / 1e4)] : undefined) || undefined;
}

/** The sizes to draw a picture at, one after the other, until it is as small as it should be: by half at most, or fine lines break up. */
export function halves(from: number, to: number): number[] {
  const steps: number[] = [];
  for (let side = from; side > to * 2; ) steps.push((side = Math.ceil(side / 2)));
  return [...steps, to];
}
