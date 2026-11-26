import { createSignal, For, onMount, Show } from "solid-js";
import { entries, near } from "../../live/store";
import type { Job } from "../../live/types";
import { change, settings } from "../../store";
import { KINDS, type Kind, type Resource } from "../../store/settings";
import { ClassMark } from "../../ui/classes";
import { day, full, time } from "../../ui/format";
import { Choices } from "../../ui/Line";
import { GameIcon } from "../../ui/Pic";
import { Waiting } from "../../ui/Waiting";
import { order, type Kept } from "../characters/logic";
import { forget, kept } from "../characters/watch";
import { showFightsOf } from "../history/Page";
import { useMaps } from "../map/data";
import { checklist, CORRIDORS, GROUP_NAMES, GROUPS, total, type Cell, type Row } from "./checklist";
import { guess, KIND_NAMES, kindOf, resets, wait } from "./logic";
import { minutes } from "./Overlay";
import { seen } from "./watch";
import "./resources.css";

const COMPLETED_NAMES = [["show", "Show"], ["hide", "Hide"], ["group", "Group"]] as const;

/** Every character side by side: what is kept, what is full, and what is done today and this week. */
export function ChecklistPage() {
  const now = minutes();
  const maps = useMaps();
  const c = () => settings.checklist;
  const member = () => settings.odyle.member;
  const everyone = () => order(Object.values(kept()), settings.resources, member(), now());
  const chars = () => everyone().filter((k) => !c().off.includes(k.name));
  const mapName = (id: number) => maps()?.maps.find((m) => m.id === id)?.name ?? "";
  const all = () => checklist(chars(), settings.resources, member(), now(), mapName);
  const shown = () => all().filter((r) => !c().hidden.includes(r.key) && !(c().completed === "hide" && r.done));
  const hidden = () => all().filter((r) => c().hidden.includes(r.key));
  const groups = () => {
    const rows = shown();
    const apart = c().completed === "group";
    const list = GROUPS.map((g) => [GROUP_NAMES[g], rows.filter((r) => r.group === g && !(apart && r.done))] as const);
    return [...list, ...(apart ? [["Completed", rows.filter((r) => r.done)] as const] : [])].filter(([, r]) => r.length);
  };
  const many = () => chars().length > 1;
  const hide = (key: string, on: boolean) => change((s) => (s.checklist.hidden = on ? [...s.checklist.hidden, key] : s.checklist.hidden.filter((k) => k !== key)));
  const [open, setOpen] = createSignal(false);
  return (
    <div class="page">
      <header class="page-head">
        <h1>Checklist</h1>
        <div class="check-resets ui-num">
          <span><small>Daily</small><b>{wait(resets(now()).daily)}</b></span>
          <span><small>Weekly</small><b>{wait(resets(now()).weekly)}</b></span>
        </div>
      </header>
      <Show when={everyone().length} fallback={<Waiting idle="Each character shows here as you log in with it." />}>
        <div class="check-tools">
          <span class="ui-muted ui-small">Completed</span>
          <Choices name="Completed rows" all={COMPLETED_NAMES} value={c().completed} set={(v) => change((s) => (s.checklist.completed = v))} />
          <button class="ui-button check-settings" onClick={() => setOpen(true)}><span class="ui-icon" aria-hidden="true">{""}</span> Settings</button>
        </div>
        <div class="check-wrap">
          <table class="check">
            <thead>
              <tr>
                <th scope="col" class="check-corner"><small class="ui-muted">As last seen, with what came back since</small></th>
                <For each={chars()}>{(k) => <th scope="col"><Head k={k} now={now()} /></th>}</For>
                <Show when={many()}><th scope="col" class="check-sum">All</th></Show>
              </tr>
            </thead>
            <For each={groups()}>
              {([name, rows]) => (
                <tbody>
                  <tr class="check-group"><th scope="rowgroup" colspan={chars().length + (many() ? 2 : 1)}>{name}</th></tr>
                  <For each={rows}>
                    {(r) => (
                      <tr data-done={r.done || undefined}>
                        <th scope="row">
                          <span class="check-name"><RowPic r={r} /><span>{r.name}</span></span>
                          <button class="ui-icon-button check-eye" aria-label={`Hide ${r.name}`} onClick={() => hide(r.key, true)}>{""}</button>
                        </th>
                        <For each={r.cells}>{(cell) => <td><CellView cell={cell} /></td>}</For>
                        <Show when={many()}><td class="check-sum ui-num">{r.sum ? full(total(r)) : ""}</td></Show>
                      </tr>
                    )}
                  </For>
                </tbody>
              )}
            </For>
          </table>
        </div>
        <Show when={hidden().length}>
          <details class="check-hidden">
            <summary>{hidden().length} hidden</summary>
            <For each={hidden()}>
              {(r) => (
                <div class="check-hidden-row">
                  <span class="check-name"><RowPic r={r} /><span>{r.name}</span></span>
                  <button class="ui-icon-button" aria-label={`Show ${r.name}`} onClick={() => hide(r.key, false)}>{""}</button>
                </div>
              )}
            </For>
          </details>
        </Show>
      </Show>
      <Show when={open()}><Settings everyone={everyone()} rows={all()} close={() => setOpen(false)} /></Show>
    </div>
  );
}

function Head(props: { k: Kept; now: number }) {
  return (
    <div class="check-char">
      <ClassMark job={props.k.job as Job} />
      <span>
        <b>{props.k.name}</b>
        <small class="ui-muted">
          <Show when={near.you?.name === props.k.name} fallback={`${day(props.k.at, props.now)}, ${time(props.k.at)}`}><span class="check-now">Playing now</span></Show>
        </small>
      </span>
    </div>
  );
}

function RowPic(props: { r: Row }) {
  const glyph = () => <span class="ui-icon">{props.r.glyph}</span>;
  return (
    <span class="thing-pic check-pic" aria-hidden="true">
      <Show when={props.r.icon} fallback={glyph()}>{(name) => <GameIcon name={name()}>{glyph()}</GameIcon>}</Show>
    </span>
  );
}

function CellView(props: { cell?: Cell }) {
  return (
    <Show when={props.cell} fallback={<span class="ui-muted">-</span>}>
      {(c) => (
        <div class="check-cell" data-lost={c().lost || undefined} data-done={c().done || undefined}>
          <span class="check-value ui-num">
            <Show when={c().done}><span class="ui-icon check-tick" aria-label="Done">{""}</span></Show>
            <b>{c().text ?? full(c().n)}</b>
            <Show when={c().most}>{(m) => <span class="ui-muted"> / {full(m())}</span>}</Show>
            <Show when={c().more}>{(m) => <span class="bonus"> {m()}</span>}</Show>
          </span>
          <Show when={c().most}>{(m) => <span class="check-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (c().n / m()) * 100)}%` }} /></span>}</Show>
          <Show when={c().note}>{(n) => <small class="ui-muted">{n()}</small>}</Show>
        </div>
      )}
    </Show>
  );
}

/** Characters and rows to show, and what the game's numbers are. */
function Settings(props: { everyone: Kept[]; rows: Row[]; close: () => void }) {
  let dialog!: HTMLDialogElement;
  onMount(() => dialog.showModal());
  const c = () => settings.checklist;
  const flip = (list: "hidden" | "off", key: string) =>
    change((s) => (s.checklist[list] = s.checklist[list].includes(key) ? s.checklist[list].filter((k) => k !== key) : [...s.checklist[list], key]));
  const [sure, setSure] = createSignal("");
  const ids = () => [...new Set([...props.everyone.flatMap((k) => k.counts.map(([id]) => id)), ...entries().counts.map(([id]) => id)])].sort((a, b) => a - b);
  const known = (id: number): Resource => settings.resources.find((r) => r.id === id) ?? { id, name: "", kind: "", show: false };
  const set = (id: number, to: Partial<Resource>) =>
    change((s) => {
      const next = { ...known(id), ...to };
      const at = s.resources.findIndex((r) => r.id === id);
      if (at < 0) s.resources.push(next);
      else s.resources[at] = next;
    });
  const named = () => new Set(ids().map((id) => kindOf(id, settings.resources)));
  const maybe = (id: number) => (kindOf(id, settings.resources) ? "" : guess(seen()[id], named(), settings.odyle.member));
  return (
    <dialog ref={dialog} class="ui-sheet check-sheet" aria-label="Checklist settings" onClose={props.close}>
      <header class="check-sheet-head">
        <h2>Checklist settings</h2>
        <button class="ui-icon-button" aria-label="Close" onClick={() => dialog.close()}>{""}</button>
      </header>
      <h3>Characters</h3>
      <For each={props.everyone}>
        {(k) => (
          <div class="check-set-row">
            <button class="ui-switch-row" role="switch" aria-checked={!c().off.includes(k.name)} onClick={() => flip("off", k.name)}>
              <span class="ui-switch-text"><span class="check-char"><ClassMark job={k.job as Job} /><b>{k.name}</b></span></span>
              <span class="ui-switch" aria-hidden="true" />
            </button>
            <button class="ui-button" onClick={() => (dialog.close(), showFightsOf(k.name))}>Fights</button>
            <button class="ui-button" onClick={() => (sure() === k.name ? (forget(k.name), setSure("")) : setSure(k.name))}>{sure() === k.name ? "Forget them?" : "Forget"}</button>
          </div>
        )}
      </For>
      <h3>Rows</h3>
      <For each={GROUPS.filter((g) => props.rows.some((r) => r.group === g))}>
        {(g) => (
          <>
            <small class="ui-muted check-set-group">{GROUP_NAMES[g]}</small>
            <For each={props.rows.filter((r) => r.group === g)}>
              {(r) => (
                <button class="ui-switch-row" role="switch" aria-checked={!c().hidden.includes(r.key)} onClick={() => flip("hidden", r.key)}>
                  <span class="ui-switch-text"><span class="check-name"><RowPic r={r} /><span>{r.name}</span></span></span>
                  <span class="ui-switch" aria-hidden="true" />
                </button>
              )}
            </For>
          </>
        )}
      </For>
      <Show when={ids().length}>
        <h3>The game's numbers</h3>
        <p class="ui-muted ui-small">The game gives each entry a number. Those without a known name can be named here. On the meter shows it in the meter's footer and the Odyle and tickets overlay.</p>
        <For each={ids()}>
          {(id) => (
            <div class="check-id">
              <span class="ui-muted ui-num">{id}</span>
              <select class="ui-select" aria-label={`What ${id} is`} value={kindOf(id, settings.resources)} onChange={(e) => set(id, { kind: e.currentTarget.value as Resource["kind"] })}>
                <option value="">Not known</option>
                <For each={KINDS}>{(kind) => <option value={kind}>{KIND_NAMES[kind]}</option>}</For>
              </select>
              <input class="ui-input" aria-label={`Name of ${id}`} placeholder={CORRIDORS[id] ?? "No name"} value={known(id).name} maxlength={40} onChange={(e) => set(id, { name: e.currentTarget.value.trim() })} />
              <button class="ui-chip" aria-pressed={known(id).show} onClick={() => set(id, { show: !known(id).show })}>On the meter</button>
              <Show when={maybe(id)}>
                {(kind) => (
                  <span class="check-guess">
                    <small>It grows as {KIND_NAMES[kind() as Kind]} does. Is it that?</small>
                    <button class="ui-button" onClick={() => set(id, { kind: kind() as Kind })}>Yes</button>
                  </span>
                )}
              </Show>
            </div>
          )}
        </For>
      </Show>
    </dialog>
  );
}
