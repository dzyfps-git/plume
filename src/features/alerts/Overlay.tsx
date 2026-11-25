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
import { callFile } from "../map/data";
import { upcoming } from "../time/logic";
import { fullIn } from "../characters/logic";
import { seen as grown } from "../resources/watch";
import { heard, onBoss as onBossAuras, words as callWords, type CallFile, type GameCall } from "../calls/logic";
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
  /** A countdown to this, 0 for none. */
  end: number;
}
const [banners, setBanners] = createSignal<readonly Banner[]>([]);
let counted = 0;
function show(text: string, end = 0, stay = STAY) {
  const n = ++counted;
  setBanners((all) => [...all.filter((b) => b.text !== text), { n, text, end }].slice(-MOST));
  setTimeout(() => setBanners((all) => all.filter((b) => b.n !== n)), Math.max(stay, end - Date.now()));
}

/** Boss calls, once the file is read. None when there is no file. */
let file: CallFile | undefined;
/** The same call again this soon counts once. */
const AGAIN = 1_200;
const said = new Map<string, number>();
function gameCall(c: GameCall, end: number) {
  const now = Date.now();
  if (now - (said.get(c.key) ?? -AGAIN) < AGAIN) return;
  said.set(c.key, now);
  const text = callWords(c, settings.calls.mode, file!);
  show(text, end);
  if (settings.calls.voice) speak(text);
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
  callFile().then((f) => (file = f), () => undefined);
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
      else if ((h.what === "begin" || h.what === "use") && file && settings.calls.on && !sampling()) {
        for (const c of heard(file, h.what === "begin" ? "cast" : "use", h.skill, settings.calls.off)) gameCall(c, c.lead ? Date.now() + c.lead : 0);
      }
    });

    // Events about to begin, and Odyle Energy about to be full. Each once.
    const told = new Set<string>();
    let filling = false;
    setInterval(() => {
      const now = Date.now();
      const before = settings.events.before * 60_000;
      for (const n of upcoming(now, settings.events.off)) {
        const key = `${n.event.id} ${n.start}`;
        const due = before ? !n.open && n.start - now <= before : n.open && now - n.start < 60_000;
        if (due && !told.has(key)) {
          told.add(key);
          alert({ id: "event", text: before ? `${n.event.name} in ${Math.max(1, Math.round((n.start - now) / 60_000))} min` : `${n.event.name} opens` });
        }
      }
      const odyle = near.you ? near.odyle[0] : -1;
      const soon = odyle >= 0 && fullIn(odyle, settings.odyle.member, grown().odyle, now) <= 30 * 60_000;
      if (soon && !filling && !sampling()) alert({ id: "full", text: "Odyle Energy nearly full" });
      filling = soon;
    }, 15_000);

    onKept((kept, all) => {
      const more = gain(kept, all);
      if (more) alert({ id: "best", text: `New best, ${signed(more)}` });
    });

    let phases = { id: 0, seen: new Map<string, boolean>() };
    createEffect(() => {
      const [id, auras] = [near.target?.boss && !sampling() ? near.target.id : 0, near.target?.boss ? near.target.auras.map((a) => ({ ...a })) : []];
      untrack(() => {
        if (!file || !settings.calls.on) return;
        const now = onBossAuras(file, auras, phases.id === id ? phases.seen : new Map(), settings.calls.off, Date.now());
        if (id && phases.id === id) {
          for (const s of now.shown) gameCall(s.call, s.end);
          if (now.safe) show(file.safe, 0, 2_500);
        }
        phases = { id, seen: now.seen };
      });
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
      <For each={banners()}>{(b) => <strong class="callout">{b.text}{b.end > now() ? `, ${remaining(b.end - now())}` : ""}</strong>}</For>
      <Show when={words()}>{(text) => <p class="callout-notes glass">{text()}</p>}</Show>
      <Show when={empty()}><strong class="callout">Callouts</strong></Show>
    </section>
  );
}
