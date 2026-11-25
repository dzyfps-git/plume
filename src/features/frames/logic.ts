import type { Unit } from "../../live/types.ts";

/** Health from 0 to 1. Nothing when it is not known. */
export const share = (u: Pick<Unit, "hp" | "maxHp">) => (u.hp < 0 || u.maxHp <= 0 ? undefined : Math.min(1, u.hp / u.maxHp));

export const dead = (u: Pick<Unit, "hp">) => u.hp === 0;

export const who = (u: Pick<Unit, "name" | "you">, at: number, hide: boolean) =>
  u.you ? u.name || "You" : hide || !u.name ? `Player ${at + 1}` : u.name;
