import { FEATURES } from "../features";
import { overlayName } from "../features/types";
import { SECOND, type Second } from "../store/settings";

type Part = Second["parts"][number];
export const featureOf = (part: Part) => FEATURES.find((f) => f.id === part);
export const SECOND_NAMES = Object.fromEntries(SECOND.map((p) => [p, p === "curve" ? "Damage over the fight" : overlayName(featureOf(p)!)])) as Record<Part, string>;
