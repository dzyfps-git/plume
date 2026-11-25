import { Show } from "solid-js";
import { fight } from "../../live/store";
import { clock, short } from "../../ui/format";
import { hp, timeLeft } from "./logic";
import "../meter/meter.css";
import "./boss.css";

export function BossOverlay() {
  const share = () => (fight.target.maxHp > 0 ? hp(fight) / fight.target.maxHp : 0);
  return (
    <section class="boss glass" aria-label="Boss health">
      <div class="boss-line">
        <strong>{fight.target.name}</strong>
        <Show when={timeLeft(fight)}>{(ms) => <span class="ui-num">falls in {clock(ms())}</span>}</Show>
        <b class="ui-num">{(share() * 100).toFixed(1)}%</b>
      </div>
      <div class="boss-bar" style={{ "--length": share() }}>
        <i />
        <span class="ui-num">{short(hp(fight))} / {short(fight.target.maxHp)}</span>
      </div>
      <Show when={fight.target.stagger >= 0}>
        <div class="boss-stagger" role="img" aria-label="Stagger" style={{ "--length": 1 - fight.target.stagger / 100 }}>
          <i />
        </div>
      </Show>
    </section>
  );
}
