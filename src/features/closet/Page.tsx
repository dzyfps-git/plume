import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { full } from "../../ui/format";
import { Choices } from "../../ui/Line";
import { skinFile } from "../map/data";
import { GRADES, groups, rows, slotName, SLOTS, type Show as Shown } from "./logic";
import { closet } from "./watch";
import "../loot/loot.css";
import "./closet.css";

const SHOW = [["missing", "Not yet"], ["have", "In the Closet"], ["all", "All"]] as const;
/** Rows drawn at most; a search or a slot narrows the rest. */
const MOST = 200;

export function ClosetPage() {
  const [file] = createResource(() => skinFile().catch(() => null));
  const [show, setShow] = createSignal<Shown>("missing");
  const [slot, setSlot] = createSignal("");
  const [query, setQuery] = createSignal("");
  const owned = createMemo(() => new Set(closet().ids));
  const list = createMemo(() => (file() ? rows(file()!, owned(), show(), slot(), query()) : []));
  const told = () =>
    closet().told
      ? `The game said your Closet on ${new Date(closet().told).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}, and each skin since.`
      : "The game says your Closet as you log in with live data on. Until then, every skin shows as not yet.";

  return (
    <div class="page">
      <header class="page-head">
        <h1>Closet</h1>
        <input class="ui-input" type="search" placeholder="Search a skin or where it comes from" aria-label="Search a skin or where it comes from" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
      </header>
      <Show when={file()} fallback={<div class="ui-empty"><p>{file.loading ? "Reading the skins." : "The skin file is not on this PC. The engine's tools/db.py writes it."}</p></div>}>
        {(f) => (
          <>
            <div class="stats">
              <div class="stat" data-hero><small>In the Closet</small><b class="ui-num">{full(owned().size)} of {full(Object.keys(f().skins).length)}</b></div>
              <For each={groups(f(), owned())}>{(g) => <div class="stat"><small>{g.name}</small><b class="ui-num">{full(g.have)} of {full(g.all)}</b></div>}</For>
            </div>
            <p class="ui-muted ui-small">{told()}</p>
            <div class="closet-filters">
              <Choices name="Show" all={SHOW} value={show()} set={setShow} />
              <select class="ui-select" aria-label="Slot" value={slot()} onChange={(e) => setSlot(e.currentTarget.value)}>
                <option value="">Every slot</option>
                <For each={Object.entries(SLOTS)}>
                  {([group, slots]) => <optgroup label={group}><For each={[...slots]}>{(s) => <option value={s}>{slotName(s)}</option>}</For></optgroup>}
                </For>
              </select>
            </div>
            <p class="ui-muted ui-small">{list().length > MOST ? `${MOST} of ${full(list().length)} shown: a search or a slot narrows them.` : `${list().length} shown.`}</p>
            <div class="closet-list">
              <For each={list().slice(0, MOST)}>
                {(r) => (
                  <div class="ui-row-item closet-row" data-have={r.have || undefined}>
                    <span>
                      <b data-grade={GRADES[r.skin[2]]}>{r.skin[0]}</b>
                      <Show when={r.skin[1]}><small class="ui-muted"> or {r.skin[1]}</small></Show>
                    </span>
                    <small class="ui-muted">{slotName(r.skin[3])}</small>
                    <small class="closet-from">{r.skin[5].slice(0, 3).join("; ")}{r.skin[5].length > 3 ? `; and ${r.skin[5].length - 3} more` : ""}</small>
                    <small class="ui-num">{r.have ? "In the Closet" : ""}</small>
                  </div>
                )}
              </For>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
