import { Show } from "solid-js";
import type { Job } from "../live/types";
import { settings } from "../store";
import { GameIcon } from "./Pic";
import "./icons.css";
import "./art.css";

/** Each class's name, colour and mark. The marks are drawn for this app, and stand in for the game's emblems. */
export const CLASSES: Record<Exclude<Job, "">, { name: string; color: string; mark: string }> = {
  gladiator: { name: "Gladiator", color: "#e0564f", mark: "M5 19 17 7M14 4l6 6M4 16l4 4" },
  templar: { name: "Templar", color: "#4f8dee", mark: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" },
  ranger: { name: "Ranger", color: "#4fb968", mark: "M7 3c8 3 11 10 10 18M7 3l-2 5M7 3l5-1M4 20 15 9" },
  assassin: { name: "Assassin", color: "#9a6bf0", mark: "M5 4l8 8-3 3M19 4l-8 8 3 3M6 20l4-5M18 20l-4-5" },
  sorcerer: { name: "Sorcerer", color: "#ee7fc0", mark: "M12 3c4 5 6 7 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 3 1 1-2 0-4 0-6z" },
  cleric: { name: "Cleric", color: "#efcf63", mark: "M12 4v16M4 12h16" },
  spiritmaster: { name: "Spiritmaster", color: "#3fc3cf", mark: "M12 12m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0M3 14c4 5 14 5 18 0M21 10C17 5 7 5 3 10" },
  chanter: { name: "Chanter", color: "#f0964c", mark: "M6 21 16 7M14 3a5 5 0 1 1 4 8" },
  fighter: { name: "Fighter", color: "#c2d34f", mark: "M6 11V8a2 2 0 0 1 4 0V6a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v6c0 4-2 7-6 7s-6-3-6-6z" },
};

const NONE = { name: "Unknown class", color: "#8d8b97", mark: "M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0" };

/** Apart in lightness as well as hue, after Okabe and Ito, for eyes that mix up red and green. */
const SAFE: Record<keyof typeof CLASSES, string> = {
  gladiator: "#d55e00", templar: "#2f7bd9", ranger: "#009e73", assassin: "#cc79a7", sorcerer: "#f0e442",
  cleric: "#d9d9d9", spiritmaster: "#56b4e9", chanter: "#e69f00", fighter: "#7a5c3a",
};

export function classOf(job: Job) {
  const found = CLASSES[job as keyof typeof CLASSES];
  if (!found) return NONE;
  const color = settings.colors[job as keyof typeof CLASSES] || (settings.safeColors && SAFE[job as keyof typeof CLASSES]);
  return color ? { ...found, color } : found;
}

export function ClassMark(props: { job: Job }) {
  return (
    <span class="class-mark" role="img" aria-label={classOf(props.job).name} style={{ "--class-color": classOf(props.job).color }}>
      <GameIcon name={`class_icon_${props.job === "spiritmaster" ? "elementalist" : props.job || "none"}`}>
        <svg viewBox="0 0 24 24"><path d={classOf(props.job).mark} /></svg>
      </GameIcon>
    </span>
  );
}

/** NC's picture of a class, behind what it is in. Nothing when there is none in the folder. */
export function ClassArt(props: { job: Job }) {
  return (
    <Show when={settings.against.art && props.job}>
      <span class="class-art" aria-hidden="true"><GameIcon name={`art_${props.job}`}>{null}</GameIcon></span>
    </Show>
  );
}
