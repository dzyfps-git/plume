/** You stopped hitting for `idle` ms: the run is over as it stands. Damage over time is not counted by the engine, so
 * this is only your hits. An `idle` of 0 never ends one. */
export const runOver = (hitAt: number, now: number, idle = 6_000) => idle > 0 && hitAt > 0 && now - hitAt >= idle;
