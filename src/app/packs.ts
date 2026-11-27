// Style packs: one choice that changes the look of every overlay, the alerts' sounds and the pictures at once.
import { ALERTS, type Settings } from "../store/settings.ts";

export interface Pack {
  id: string;
  name: string;
  about: string;
  wear: (s: Settings) => void;
}

/** Every alert's sound, the louder ones a little louder. */
const sounds = (s: Settings, loud: string, soft: string) => {
  for (const id of ALERTS) s.alerts[id].sound = ["low", "ally", "died", "enrage"].includes(id) ? loud : soft;
};

export const PACKS: Pack[] = [
  {
    id: "glass", name: "Quiet glass", about: "See-through glass, thin lines, soft chimes.",
    wear: (s) => {
      Object.assign(s.look, { theme: "glass", outline: "", font: "house", mark: 0, thin: false, strong: false });
      Object.assign(s.meter, { style: "line", icons: true });
      s.accent = "";
      s.pictures = true;
      sounds(s, "drop", "chime");
    },
  },
  {
    id: "bold", name: "Bold", about: "Solid bars, strong outlines, narrow type, warm colours, sharp sounds.",
    wear: (s) => {
      Object.assign(s.look, { theme: "solid", outline: "solid", font: "narrow", mark: 0.2, thin: true, strong: true });
      Object.assign(s.meter, { style: "bar", icons: true });
      s.accent = "ember";
      s.pictures = true;
      sounds(s, "alarm", "rise");
    },
  },
  {
    id: "minimal", name: "Minimal", about: "A plain table, no class marks or pictures, quiet ticks.",
    wear: (s) => {
      Object.assign(s.look, { theme: "minimal", outline: "", font: "mono", mark: 0, thin: false, strong: false });
      Object.assign(s.meter, { style: "table", icons: false });
      s.accent = "mono";
      s.pictures = false;
      sounds(s, "drop", "tick");
    },
  },
  {
    id: "neon", name: "Neon", about: "Cards with soft outlines, class colours behind rows, bright sounds.",
    wear: (s) => {
      Object.assign(s.look, { theme: "glass", outline: "soft", font: "round", mark: 0.35, thin: false, strong: false });
      Object.assign(s.meter, { style: "cards", icons: true });
      s.accent = "rose";
      s.pictures = true;
      sounds(s, "alarm", "chime");
    },
  },
  {
    id: "stream", name: "For a stream", about: "Large, dark and easy to read on a video, names hidden.",
    wear: (s) => {
      Object.assign(s.look, { theme: "solid", outline: "solid", font: "house", size: 1.2, shade: 0.6, strong: true });
      Object.assign(s.meter, { style: "bar", icons: true });
      s.accent = "ocean";
      s.discreet = true;
      sounds(s, "alarm", "rise");
    },
  },
];

/** Puts back each value a pack changed and that still holds the pack's value: what you changed since stays. */
type Tree = Record<string, unknown>;
const tree = (v: unknown): v is Tree => !!v && typeof v === "object" && !Array.isArray(v);
export function putBack<T extends object>(now: T, was: T, worn: T) {
  const n = now as Tree, a = was as Tree, b = worn as Tree;
  for (const k of Object.keys(b)) {
    if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
    if (tree(a[k]) && tree(b[k]) && tree(n[k])) putBack(n[k] as Tree, a[k] as Tree, b[k] as Tree);
    else if (JSON.stringify(n[k]) === JSON.stringify(b[k])) n[k] = structuredClone(a[k]);
  }
}
