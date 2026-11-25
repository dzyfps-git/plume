import { For, Show } from "solid-js";
import { entries, near } from "../../live/store";
import { change, settings } from "../../store";
import { KINDS, ODYLE_RUN, type Resource } from "../../store/settings";
import { full } from "../../ui/format";
import { Thing, type ThingName } from "../../ui/icons";
import { Choices, Line } from "../../ui/Line";
import { Waiting } from "../../ui/Waiting";
import { KIND_NAMES, kindOf, nameOf, resets, runsLeft, wait } from "./logic";
import { minutes } from "./Overlay";
import "./resources.css";

export function ResourcesPage() {
  const now = minutes();
  const known = (id: number): Resource => settings.resources.find((r) => r.id === id) ?? { id, name: "", kind: "", show: false };
  const set = (id: number, to: Partial<Resource>) =>
    change((s) => {
      const next = { ...known(id), ...to };
      const at = s.resources.findIndex((r) => r.id === id);
      if (at < 0) s.resources.push(next);
      else s.resources[at] = next;
    });
  const some = () => entries().counts.length > 0 || near.odyle[0] >= 0;
  const stats = () =>
    [
      ["Odyle Energy", near.odyle[0] < 0 ? "" : full(near.odyle[0]), "odyle"],
      ["Odyle charged", near.odyle[1] <= 0 ? "" : full(near.odyle[1]), "odyle"],
      ["Runs left", near.odyle[0] < 0 ? "" : String(runsLeft(near.odyle, settings.odyleRun))],
      ["Daily Duties", entries().duty[0] < 0 ? "" : `${entries().duty[0]} of ${entries().duty[1]}`],
      ["Abyss Points this week", entries().points[0] < 0 ? "" : `${full(entries().points[0])} of ${full(entries().points[1])}`, "points"],
      ["Kina today", entries().kinah < 0 ? "" : full(entries().kinah), "kina"],
      ["Daily reset in", wait(resets(now()).daily)],
      ["Weekly reset in", wait(resets(now()).weekly)],
    ].filter(([, value]) => value) as [name: string, value: string, thing?: ThingName][];
  return (
    <div class="page">
      <header class="page-head">
        <h1>Resources</h1>
      </header>
      <Show when={some()} fallback={<Waiting idle="The game says what is left as you log in or change character." />}>
        <div class="stats">
          <For each={stats()}>{([name, value, thing]) => <div class="stat"><small><Show when={thing}>{(t) => <Thing of={t()} />}</Show> {name}</small><b class="ui-num">{value}</b></div>}</For>
        </div>
        <section class="block">
          <Line name="Odyle Energy a run takes" about="80 is claiming twice in one run, with a membership: half the runs.">
            <Choices name="Odyle Energy a run takes" all={ODYLE_RUN.map((n) => [n, String(n)] as const)} value={settings.odyleRun} set={(n) => change((s) => (s.odyleRun = n))} />
          </Line>
        </section>
        <section class="block">
          <h2>Tickets and entries</h2>
          <p class="ui-muted ui-small">The game gives each a number and no name. Find it by its two figures, say once what it is, and choose what the overlay and the meter's footer show.</p>
          <For each={entries().counts}>
            {([id, first, second]) => (
              <div class="ui-row-item left-row">
                <span class="left-what">
                  <Show when={kindOf(id, settings.resources)} fallback={<span class="ui-muted ui-num">{id}</span>}>{(kind) => <Thing of={kind() as ThingName} />}</Show>
                  <select class="ui-select" aria-label={`What ${id} is`} value={kindOf(id, settings.resources)} onChange={(e) => set(id, { kind: e.currentTarget.value as Resource["kind"] })}>
                    <option value="">Not known</option>
                    <For each={KINDS}>{(kind) => <option value={kind}>{KIND_NAMES[kind]}</option>}</For>
                  </select>
                </span>
                <input class="ui-input" aria-label={`Name of ${id}`} placeholder={nameOf(id, settings.resources) || "No name"} value={known(id).name} maxlength={40} onChange={(e) => set(id, { name: e.currentTarget.value.trim() })} />
                <span class="ui-num">{full(first)}</span>
                <span class="ui-muted ui-num">{second > 0 ? `+${full(second)}` : ""}</span>
                <button class="ui-chip" aria-pressed={known(id).show} aria-label={`Show ${nameOf(id, settings.resources) || id}`} onClick={() => set(id, { show: !known(id).show })}>Show</button>
              </div>
            )}
          </For>
        </section>
      </Show>
    </div>
  );
}
