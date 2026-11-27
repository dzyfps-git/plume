import { For, Show, type JSX } from "solid-js";
import { fight } from "../../live/store";
import { settings } from "../../store";
import { plan } from "../../store/settings";
import { clock, short } from "../../ui/format";
import { apart, shareAt, timeAt } from "../best/logic";
import { earlier, followRival, rivalTrail } from "../best/rival";
import { key, pace } from "../bosses/logic";
import { hp, timeLeft } from "./logic";
import "./boss.css";
import "../best/best.css";

/** The boss's health, how long until it falls, and its stagger gauge. What is inside stands at the end of the last line. */
export function BossBar(props: { title?: string; beside?: JSX.Element; children?: JSX.Element }) {
  followRival();
  const share = () => (fight.target.maxHp > 0 ? hp(fight) / fight.target.maxHp : 0);
  const set = () => plan(settings.bosses[key({ code: fight.target.code, target: fight.target.name })]);
  // Where its health should be to fall just in time.
  const due = () => pace(fight.ms, set().enrage);
  const behind = () => (due() ?? 1) < share();
  // Your best kill: where its health was by now, and when it was where it is now.
  const was = () => (fight.ms > 0 ? shareAt(rivalTrail(), fight.ms) : undefined);
  const then = () => (fight.ms > 0 ? timeAt(rivalTrail(), share()) : undefined);
  return (
    <div class="boss">
      <div class="boss-line">
        <strong>{props.title ?? fight.target.name}</strong>
        {props.beside}
        <b class="ui-num">{(share() * 100).toFixed(1)}<small>%</small></b>
      </div>
      <div class="boss-bar" style={{ "--length": share() }}>
        <div><i class="boss-lost" /><i class="boss-hp" /></div>
        <For each={set().marks}>{(mark) => <em style={{ left: `${mark}%` }} />}</For>
        <Show when={settings.against.wipes}><For each={earlier()}>{(left) => <em class="boss-wipe" style={{ left: `${left * 100}%` }} />}</For></Show>
        <Show when={settings.against.rival && was() !== undefined}>
          <em class="boss-rival" data-behind={was()! < share() || undefined} style={{ left: `${was()! * 100}%` }} />
        </Show>
        <Show when={due() !== undefined}>
          <em class="boss-due" data-behind={behind() || undefined} style={{ left: `${due()! * 100}%` }} />
        </Show>
      </div>
      <Show when={fight.target.stagger >= 0}>
        <div class="boss-stagger" role="img" aria-label="Stagger" style={{ "--length": 1 - fight.target.stagger / 100 }}><i /></div>
      </Show>
      <div class="boss-sub">
        <span class="ui-num">{short(hp(fight))}</span>
        <Show when={timeLeft(fight)}>{(ms) => <span class="ui-num">falls in {clock(ms())}</span>}</Show>
        <Show when={settings.against.time && then() !== undefined}>
          <span class="boss-apart ui-num" classList={{ ahead: then()! >= fight.ms, behind: then()! < fight.ms }} aria-label="Against your best kill">{apart(then()! - fight.ms)}</span>
        </Show>
        {props.children}
      </div>
      <Show when={set().enrage > 0}>
        <div class="boss-enrage ui-num" data-behind={behind() || undefined}>
          <span>{behind() ? "Too slow for the enrage" : "In time for the enrage"}</span>
          <span>{fight.ms < set().enrage * 1000 ? `enrage in ${clock(set().enrage * 1000 - fight.ms)}` : "enraged"}</span>
        </div>
      </Show>
    </div>
  );
}
