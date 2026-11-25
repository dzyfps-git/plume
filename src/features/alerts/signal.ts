import { sampling } from "../../live/store";
import type { Signal } from "../../store/settings";
import { speak } from "../timers/voice";
import { play } from "./sound";

export function signal(by: Signal & { volume?: number }, words: string) {
  if (sampling()) return;
  void play(by.sound, by.volume);
  if (by.say) speak(words);
}
