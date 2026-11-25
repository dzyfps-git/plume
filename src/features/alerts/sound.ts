import { soundFile } from "../../api";
import { settings } from "../../store";

type Note = readonly [hertz: number, at: number, long: number];

/** Made here from plain tones, so there is no file to carry. */
const TONES: Record<string, { name: string; wave: OscillatorType; notes: readonly Note[] }> = {
  chime: { name: "Chime", wave: "sine", notes: [[880, 0, 0.5], [1318, 0.1, 0.6]] },
  rise: { name: "Rise", wave: "triangle", notes: [[523, 0, 0.14], [659, 0.09, 0.14], [784, 0.18, 0.3]] },
  fall: { name: "Fall", wave: "triangle", notes: [[523, 0, 0.18], [415, 0.13, 0.18], [311, 0.26, 0.45]] },
  drop: { name: "Drop", wave: "sine", notes: [[620, 0, 0.12], [420, 0.1, 0.25]] },
  alarm: { name: "Alarm", wave: "square", notes: [[740, 0, 0.1], [740, 0.16, 0.1], [740, 0.32, 0.16]] },
  tick: { name: "Tick", wave: "sine", notes: [[1500, 0, 0.06]] },
};
export const BUILT_IN: readonly (readonly [string, string])[] = Object.entries(TONES).map(([id, t]) => [id, t.name]);
export const FILE = "file:";

let context: AudioContext | undefined;
const files = new Map<string, Promise<AudioBuffer>>();

const load = (to: AudioContext, name: string) => {
  const found = files.get(name) ?? soundFile(name).then((bytes) => to.decodeAudioData(bytes));
  files.set(name, found);
  // A file that failed may be there the next time.
  found.catch(() => files.delete(name));
  return found;
};

/** Plays a sound by its id. One that is gone stays silent. */
export async function play(sound: string, volume = 1) {
  if (!sound || settings.voice.mute) return;
  context ??= new AudioContext();
  const to = context;
  const all = to.createGain();
  all.gain.value = settings.voice.volume * volume;
  all.connect(to.destination);
  try {
    await to.resume();
    if (sound.startsWith(FILE)) {
      const source = to.createBufferSource();
      source.buffer = await load(to, sound.slice(FILE.length));
      source.connect(all);
      source.start();
      return;
    }
    const tone = TONES[sound];
    for (const [hertz, at, long] of tone?.notes ?? []) {
      const [voice, gain, from] = [to.createOscillator(), to.createGain(), to.currentTime + at];
      voice.type = tone.wave;
      voice.frequency.value = hertz;
      const loud = tone.wave === "square" ? 0.12 : 0.35;
      gain.gain.setValueAtTime(0, from);
      gain.gain.linearRampToValueAtTime(loud, from + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, from + long);
      voice.connect(gain).connect(all);
      voice.start(from);
      voice.stop(from + long);
    }
  } catch (failure) {
    console.error(failure);
  }
}
