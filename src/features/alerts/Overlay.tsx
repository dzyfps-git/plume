import { createEffect, createMemo, createRoot, createSignal, For, Show, untrack } from "solid-js";
import { fight, near, onHappened, sampling } from "../../live/store";
import { hideNames, settings } from "../../store";
import { plan } from "../../store/settings";
import { ticking } from "../../ui/now";
import { key } from "../bosses/logic";
import { left, remaining } from "../effects/logic";
import { records, skillKey } from "../best/logic";
import { fights, followFights, onKept } from "../history/store";
import { gain, signed } from "../meter/logic";
import { short } from "../../ui/format";
import { count, NONE } from "../pvp/logic";
import { speak } from "../timers/voice";
import { ahead, look, notes, onBlow, onEffects, raised, safe, streakText, type Call, type Look, type Raised } from "./logic";
import { signal } from "./signal";
import "../meter/meter.css";
import "./alerts.css";

/** A line stays this long. */
const STAY = 4_000;
const MOST = 4;

interface Banner {
  n: number;
  text: string;
}
const [banners, setBanners] = createSignal<readonly Banner[]>([]);
let counted = 0;
function show(text: string) {
  const n = ++counted;
  setBanners((all) => [...all.filter((b) => b.text !== text), { n, text }].slice(-MOST));
  setTimeout(() => setBanners((all) => all.filter((b) => b.n !== n)), STAY);
}

const bossKey = () => key({ code: fight.target.code, target: fight.target.name });
const set = () => plan(settings.bosses[bossKey()]);
const job = () => near.you?.job ?? "";
/** The boss that is fought now, and not one of the fights before. */
const onBoss = () => near.fighting && fight.target.boss && fight.rows.length > 0;
const untouchable = () => (near.target?.boss ? safe(near.target.auras) : undefined);

let words: () => string = () => "";
export const empty = () => !banners().length && !words() && !untouchable();

function alert(r: Raised) {
  const a = settings.alerts[r.id];
  if (!a.on) return;
  signal(a, r.text);
  if (a.banner) show(r.text);
}

function call(all: readonly Call[]) {
  for (const c of all) {
    show(c.text);
    if (c.say) speak(c.text);
  }
}

/** Watches for what is worth your attention. */
export function followAlerts() {
  createRoot(() => {
    words = createMemo(() => notes(set(), fight, near.fighting));

    let before: Look | undefined;
    createEffect(() => {
      const now = look(near, settings.alerts, before, settings.control);
      const made = sampling();
      untrack(() => {
        // The first look is how things are, and nothing that happened.
        if (before && !made) for (const r of raised(before, now, near, hideNames())) alert(r);
        before = near.you && !made ? now : undefined;
      });
    });

    // Your biggest hits so far. A skill without one has nothing to beat yet.
    followFights();
    const kept = createMemo(() => new Map(records(fights()).map((r) => [skillKey({ code: r.skill, name: r.name }), r.amount])));
    const beaten = new Map<string, number>();

    let tally = NONE;
    onHappened((h) => {
      tally = count(tally, h);
      if (h.what === "kill") alert({ id: "kill", text: streakText(tally.streak) });
      else if (h.what === "death") alert({ id: "slain", text: "Killed" });
      else if (h.what === "big") {
        const skill = skillKey({ code: h.skill, name: h.name });
        const before = Math.max(kept().get(skill) ?? 0, beaten.get(skill) ?? 0);
        if (before && h.amount > before) {
          beaten.set(skill, h.amount);
          alert({ id: "record", text: `Record: ${h.name || "a hit"}, ${short(h.amount)}` });
        }
      } else if (h.what === "blow" && onBoss()) call(onBlow(set(), h, job()));
    });

    onKept((kept, all) => {
      const more = gain(kept, all);
      if (more) alert({ id: "best", text: `New best, ${signed(more)}` });
    });

    let seen = { id: 0, keys: new Set<string>(), safe: false };
    createEffect(() => {
      const [id, auras] = [near.target?.boss && !sampling() ? near.target.id : 0, near.target?.boss ? near.target.auras.map((a) => ({ ...a })) : []];
      untrack(() => {
        if (id && seen.id === id) {
          call(onEffects(set(), auras, seen.keys, job()));
          if (seen.safe && !safe(auras)) show("Attack");
        }
        seen = { id, keys: new Set(auras.map((a) => a.key)), safe: !!safe(auras) };
      });
    });

    let at = { boss: "", ms: 0 };
    createEffect(() => {
      const now = { boss: bossKey(), ms: fight.ms };
      untrack(() => {
        if (at.boss === now.boss && onBoss()) call(ahead(set(), at.ms, now.ms, settings.voice.lead, job()));
        at = now;
      });
    });
  });
}

export function CalloutsOverlay() {
  const now = ticking();
  return (
    <section class="callouts" aria-label="Callouts" aria-live="off">
      <Show when={untouchable()}>
        {(a) => <strong class="callout" data-safe>Cannot be hurt{a().end ? `, ${remaining(left(a(), now())!)}` : ""}</strong>}
      </Show>
      <For each={banners()}>{(b) => <strong class="callout">{b.text}</strong>}</For>
      <Show when={words()}>{(text) => <p class="callout-notes glass">{text()}</p>}</Show>
      <Show when={empty()}><strong class="callout">Callouts</strong></Show>
    </section>
  );
}
