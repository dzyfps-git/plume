import { sampling } from "../../live/store";
import type { Signal } from "../../store/settings";
import { speak } from "../timers/voice";
import { play } from "./sound";

export function signal(by: Signal, words: string) {
  if (sampling()) return;
  void play(by.sound);
  if (by.say) speak(words);
}
