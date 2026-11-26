// What is wrong, and what to do about it, from what the engine says.
import type { Reads, State, Status } from "./types.ts";

export interface Light {
  name: string;
  light: "good" | "wait" | "bad";
  about: string;
}

/** So many hits read without any of something that comes with them means a game update moved it. */
const ENOUGH = 300;

/** What the engine reads of each kind. */
export function health(r: Reads): Light[] {
  const count = (name: string, n: number, sure: boolean): Light =>
    n > 0
      ? { name, light: "good", about: n.toLocaleString("en") }
      : sure && r.hits > ENOUGH
        ? { name, light: "bad", about: `None after ${r.hits.toLocaleString("en")} hits. A game update may have changed it.` }
        : { name, light: "wait", about: "None yet." };
  const known = (name: string, is: boolean, sure: boolean): Light => ({ ...count(name, is ? 1 : 0, sure), ...(is && { about: "Read." }) });
  return [
    count("Hits", r.hits, false),
    known("Which player you are", r.you, true),
    known("Target health", r.targetHealth, true),
    count("Player health", r.health, true),
    count("Buffs", r.buffs, true),
    count("Your stats", r.stats, true),
    // A dummy hits nobody and has no gauge, so none of these is no sign of trouble.
    count("Hits taken", r.taken, false),
    known("Stagger", r.stagger, false),
    known("Zone", r.zone, false),
    {
      name: "Skill names",
      light: !r.skills ? "wait" : r.unnamed * 2 > r.skills ? "bad" : "good",
      about: r.skills ? `${r.skills - r.unnamed} of ${r.skills} known` : "None yet.",
    },
  ];
}

/** The three things that have to be there, in the order they are needed. */
export function lights(engine: { status: Status; message?: string }, state: Pick<State, "live" | "devices"> | null, game: string, you = true): Light[] {
  const running = engine.status === "running" && !!state;
  // The engine is what knows the driver. Its words about a missing one say where to get it.
  const missing = engine.status === "failed" && /install it from/i.test(engine.message ?? "");
  const driver: Light = running
    ? state.devices > 0
      ? { name: "Capture driver", light: "good", about: "Ready." }
      : { name: "Capture driver", light: "bad", about: "It found no network device to listen on." }
    : missing
      ? { name: "Capture driver", light: "bad", about: engine.message! }
      : { name: "Capture driver", light: "wait", about: "Known once the engine runs." };
  const program: Light = running
    ? { name: "Engine", light: "good", about: "Running." }
    : missing
      ? { name: "Engine", light: "wait", about: "Waits for the driver." }
      : engine.status === "missing"
        ? { name: "Engine", light: "bad", about: "Not installed. Put plume-engine.exe in its folder." }
        : engine.status === "failed"
          ? { name: "Engine", light: "bad", about: engine.message || "It stopped." }
          : { name: "Engine", light: "wait", about: "Starting." };
  return [
    driver,
    program,
    running && state.live
      ? you
        ? { name: "Game", light: "good", about: "Connected." }
        : { name: "Game", light: "wait", about: "Connected, waiting for your character: change zone, or go to character select and log back in." }
      : { name: "Game", light: "wait", about: `Start ${game} and enter the world.` },
  ];
}
