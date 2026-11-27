import { createEffect, untrack } from "solid-js";
import { fight, near } from "../../live/store";
import { settings } from "../../store";
import { plan, type BossPlan } from "../../store/settings";
import { hp } from "../boss/logic";
import { calls, key } from "../bosses/logic";

/** Voices Windows itself has. Others would send the words away to be spoken. */
export const voices = () => speechSynthesis.getVoices().filter((v) => v.localService);

export function speak(text: string) {
  if (settings.voice.mute) return;
  const words = new SpeechSynthesisUtterance(text);
  const voice = voices().find((v) => v.name === settings.voice.name) ?? voices().find((v) => v.default) ?? voices()[0];
  // With no voice of its own, Windows stays silent rather than ask another computer.
  if (!voice) return;
  words.voice = voice;
  words.volume = settings.voice.volume;
  words.rate = 1.1;
  speechSynthesis.speak(words);
}

/** Without the timers that a mechanic of yours already says with its note. That is only so when the callout can be made:
 * as `ahead` in `src/features/alerts/logic.ts`, during a fight the game says, for your class or when your class is not known. */
const unsaid = (p: BossPlan): BossPlan => {
  const job = near.you?.job ?? "";
  const said = (skill: number) => near.fighting && p.mechanics.some((m) => m.say && !m.effect && m.id === skill && (!m.job || !job || m.job === job));
  return { ...p, timers: p.timers.filter((t) => !said(t.skill)) };
};

/** Says marks, timers and the enrage as the fight passes them. */
export function followVoice() {
  let before = { id: "", ms: 0, share: 1 };
  createEffect(() => {
    const { name, code, maxHp, boss } = fight.target;
    const id = key({ code, target: name });
    const now = { id, ms: fight.ms, share: maxHp > 0 ? hp(fight) / maxHp : 1 };
    untrack(() => {
      // Another target, or the same again: nothing before it was passed.
      const same = before.id === id && now.ms >= before.ms;
      if (same && boss && settings.voice.on) for (const text of calls(unsaid(plan(settings.bosses[id])), before, now, settings.voice.lead)) speak(text);
      before = now;
    });
  });
}
