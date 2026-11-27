// The engine knows a player's class only once it sees one of their skills: until then it says none. A class once seen
// is kept here, by name, so a character never loses its class mark between a login and its first skill.
import type { Fight, Job, Near } from "./types.ts";

export type Jobs = Record<string, Job>;

/** Learns the classes said, and fills in those not said. Gives the same objects back when nothing was filled in. */
export function fillJobs<T extends Fight | Near>(of: T, known: Jobs): T {
  const fill = <U extends { name: string; job: Job }>(u: U): U => {
    if (!u.name) return u;
    if (u.job) return (known[u.name] = u.job), u;
    return known[u.name] ? { ...u, job: known[u.name] } : u;
  };
  if ("rows" in of) return { ...of, rows: of.rows.map(fill) };
  const n = of as Near;
  return { ...n, you: n.you && fill(n.you), party: n.party.map(fill), target: n.target && fill(n.target), foe: n.foe && fill(n.foe) } as T;
}
