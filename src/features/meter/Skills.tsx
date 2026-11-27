import { createMemo, For, Show } from "solid-js";
import type { Job, Skill } from "../../live/types";
import { classOf } from "../../ui/classes";
import { full, percent, short } from "../../ui/format";
import { Pic } from "../../ui/Pic";
import { lines, type SkillLine } from "./logic";

type Column = [name: string, of: (s: SkillLine) => number | undefined];
/** Only those that say something for this player. */
const RATES: Column[] = [["Perfect", (s) => s.perfect], ["Double", (s) => s.double], ["Extra", (s) => s.multi], ["Parried", (s) => s.parry]];

/** One player's damage by skill, biggest first. */
export function Skills(props: { skills: readonly Skill[]; job: Job }) {
  const list = createMemo(() => lines(props.skills));
  const extra = createMemo(() => RATES.filter(([, of]) => list().some((s) => !s.dot && (of(s) ?? 0) > 0)));
  const most = () => Math.max(1, ...list().map((s) => s.damage));
  return (
    <div class="skills" role="table" aria-label="Damage by skill" style={{ "--class": classOf(props.job).color, "--columns": 7 + extra().length }}>
      <div class="skills-line skills-head" role="row">
        <span role="columnheader">Skill</span>
        <For each={["Damage", "Share", "Hits", "Average", "Biggest", "Crit", "Back", ...extra().map(([name]) => name)]}>
          {(name) => <span role="columnheader">{name}</span>}
        </For>
      </div>
      <For each={list()}>
        {(s) => (
          <div class="skills-line" role="row" style={{ "--length": s.damage / most() }}>
            <span role="cell" class="skills-name">
              <i />
              <Pic skill={s.code} name={s.name || "Skill"} />
              {s.name || `Skill ${s.code}`}
              <Show when={s.dot}>
                <small>over time</small>
              </Show>
            </span>
            <b role="cell" data-tip={full(s.damage)}>{short(s.damage)}</b>
            <span role="cell">{percent(s.share, 1)}</span>
            <span role="cell">{full(s.hits)}</span>
            <span role="cell">{short(s.average)}</span>
            <span role="cell">{short(s.max)}</span>
            <span role="cell">{s.dot ? "" : percent(s.crit, 1)}</span>
            <span role="cell">{s.dot ? "" : percent(s.back, 1)}</span>
            <For each={extra()}>
              {([name, of]) => (
                <span role="cell" data-tip={name === "Extra" && s.extras ? `${full(s.extras)} extra hits, ${full(s.bonus ?? 0)} damage` : undefined}>
                  {s.dot || of(s) === undefined ? "" : percent(of(s)!, 1)}
                </span>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
}
