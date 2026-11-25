import { For, Show } from "solid-js";
import { fight } from "../../live/store";
import { settings } from "../../store";
import { plan } from "../../store/settings";
import { clock, short } from "../../ui/format";
import { key, pace } from "../bosses/logic";
import { hp, timeLeft } from "./logic";
import "../meter/meter.css";
import "./boss.css";

export function BossOverlay() {
  const share = () => (fight.target.maxHp > 0 ? hp(fight) / fight.target.maxHp : 0);
  const set = () => plan(settings.bosses[key({ code: fight.target.code, target: fight.target.name })]);
  // Where its health should be to fall just in time.
  const due = () => pace(fight.ms, set().enrage);
  const behind = () => (due() ?? 1) < share();
  return (
    <section class="boss glass" aria-label="Boss health">
      <div class="boss-line">
        <strong>{fight.target.name}</strong>
        <Show when={timeLeft(fight)}>{(ms) => <span class="ui-num">falls in {clock(ms())}</span>}</Show>
        <b class="ui-num">{(share() * 100).toFixed(1)}%</b>
      </div>
      <div class="boss-bar" style={{ "--length": share() }}>
        <i />
        <For each={set().marks}>{(mark) => <em style={{ left: `${mark}%` }} />}</For>
        <Show when={due() !== undefined}>
          <em class="boss-due" data-behind={behind() || undefined} style={{ left: `${due()! * 100}%` }} />
        </Show>
        <span class="ui-num">{short(hp(fight))} / {short(fight.target.maxHp)}</span>
      </div>
      <Show when={set().enrage > 0}>
        <div class="boss-enrage ui-num" data-behind={behind() || undefined}>
          <span>{behind() ? "Too slow for the enrage" : "In time for the enrage"}</span>
          <span>{fight.ms < set().enrage * 1000 ? `enrage in ${clock(set().enrage * 1000 - fight.ms)}` : "enraged"}</span>
        </div>
      </Show>
      <Show when={fight.target.stagger >= 0}>
        <div class="boss-stagger" role="img" aria-label="Stagger" style={{ "--length": 1 - fight.target.stagger / 100 }}>
          <i />
        </div>
      </Show>
    </section>
  );
}
