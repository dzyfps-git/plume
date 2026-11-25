import { createEffect, createRoot } from "solid-js";
import { near } from "../live/store";
import { settings } from "../store";
import { TONES } from "../store/settings";
import { classOf } from "./classes";
import "./tones.css";

const root = document.documentElement;
const put = (name: string, value: string) => (value ? root.style.setProperty(name, value) : root.style.removeProperty(name));

/** The accent and what each colour says, as you chose them. */
export function followPaint() {
  createRoot(() =>
    createEffect(() => {
      const { accent, tones } = settings;
      const job = near.you?.job ?? "";
      const own = accent.startsWith("#") ? accent : accent === "class" && job ? classOf(job).color : "";
      if (accent && accent !== "class" && !own) root.dataset.accent = accent;
      else delete root.dataset.accent;
      put("--accent", own);
      put("--accent-start", own && `color-mix(in oklab, ${own} 82%, #8fb4ff)`);
      put("--accent-end", own && `color-mix(in oklab, ${own} 78%, #ffb3dc)`);
      for (const t of TONES) put(`--own-${t}`, tones[t] ?? "");
    }),
  );
}
