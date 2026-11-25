/** Damage over time ticks on for a while after you stop. The engine does not count those, so this is only your hits. */
const STOPPED = 6_000;

/** You stopped hitting: the run is over as it stands. */
export const runOver = (hitAt: number, now: number) => hitAt > 0 && now - hitAt >= STOPPED;
