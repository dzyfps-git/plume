import type { Job } from "../live/types";

/** Each class's name, colour and mark. The marks are drawn for this app. */
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

export const classOf = (job: Job) => CLASSES[job as keyof typeof CLASSES] ?? NONE;

export function ClassMark(props: { job: Job }) {
  return (
    <svg class="class-mark" viewBox="0 0 24 24" role="img" aria-label={classOf(props.job).name}>
      <path d={classOf(props.job).mark} />
    </svg>
  );
}
