import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { full } from "../../ui/format";
import { GameIcon } from "../../ui/Pic";
import { skinFile } from "../map/data";
import { GRADES, rows, slotName, SLOTS, type Show as Shown, type Skin } from "./logic";
import { closet } from "./watch";
import "./closet.css";

const SHOW = [["missing", "Not yet"], ["have", "In the Closet"], ["all", "All"]] as const;
const GRADE_NAMES = ["Common", "Rare", "Legend", "Unique", "Epic"];
/** Cards drawn at most; a search or a slot narrows the rest. */
const MOST = 240;

export function ClosetPage() {
  const [file] = createResource(() => skinFile().catch(() => null));
  const [show, setShow] = createSignal<Shown>("missing");
  const [slot, setSlot] = createSignal("");
  const [grade, setGrade] = createSignal(-1);
  const [query, setQuery] = createSignal("");
  const owned = createMemo(() => new Set(closet().ids));
  const skins = () => Object.entries(file()?.skins ?? {});
  const list = createMemo(() => (file() ? rows(file()!, owned(), show(), slot(), query()).filter((r) => grade() < 0 || r.skin[2] === grade()) : []));
  const count = (ok: (s: Skin) => boolean) => {
    const of = skins().filter(([, s]) => ok(s));
    return `${of.filter(([id]) => owned().has(Number(id))).length}/${of.length}`;
  };
  const told = () =>
    closet().told
      ? `The game said your Closet on ${new Date(closet().told).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}, and each skin since.`
      : "The game says your Closet as you log in with live data on. Until then, every skin shows as not yet.";

  return (
    <div class="page closet-page">
      <header class="page-head">
        <h1>Closet</h1>
        <small class="ui-muted closet-told">{told()}</small>
      </header>
      <Show when={file()} fallback={<div class="ui-empty"><p>{file.loading ? "Reading the skins." : "The skin file is not on this PC. The engine's tools/db.py writes it."}</p></div>}>
        {(f) => (
          <div class="closet-grid">
            <aside class="side-filters" aria-label="Choose skins">
              <h3>Show</h3>
              <For each={SHOW}>
                {([value, name]) => (
                  <button class="side-row" role="radio" aria-checked={show() === value} onClick={() => setShow(value)}>
                    <span class="side-radio" aria-hidden="true" />
                    <span>{name}</span>
                  </button>
                )}
              </For>
              <h3>
                Grade
                <Show when={grade() >= 0 || slot()}><button class="side-reset" onClick={() => (setGrade(-1), setSlot(""))}>Reset</button></Show>
              </h3>
              <For each={GRADE_NAMES.map((name, i) => [name, i] as const).filter(([, i]) => skins().some(([, s]) => s[2] === i))}>
                {([name, i]) => (
                  <button class="side-row" style={{ "--tint": `var(--grade-${GRADES[i]})` }} aria-pressed={grade() === i} onClick={() => setGrade(grade() === i ? -1 : i)}>
                    <span class="tint-dot" aria-hidden="true" />
                    <span>{name}</span>
                    <small class="ui-num">{count((s) => s[2] === i)}</small>
                  </button>
                )}
              </For>
              <For each={Object.entries(SLOTS)}>
                {([group, slots]) => (
                  <>
                    <h3>{group} <small class="ui-num">{count((s) => (slots as readonly string[]).includes(s[3]))}</small></h3>
                    <For each={[...slots]}>
                      {(s) => (
                        <button class="side-row" aria-pressed={slot() === s} onClick={() => setSlot(slot() === s ? "" : s)}>
                          <span aria-hidden="true" />
                          <span>{slotName(s)}</span>
                          <small class="ui-num">{count((k) => k[3] === s)}</small>
                        </button>
                      )}
                    </For>
                  </>
                )}
              </For>
            </aside>

            <section class="closet-main">
              <div class="closet-sum">
                <b>In the Closet</b>
                <b class="ui-num">{full(owned().size)}</b>
                <span class="ui-muted ui-num">of {full(skins().length)}</span>
                <i class="tint-bar" style={{ "--done": skins().length ? owned().size / skins().length : 0 }} />
              </div>
              <input class="ui-input" type="search" placeholder="Search a skin or where it comes from" aria-label="Search a skin or where it comes from" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
              <small class="ui-muted">{list().length > MOST ? `${MOST} of ${full(list().length)} shown: a search, a grade or a slot narrows them.` : `${full(list().length)} shown.`}</small>
              <div class="skins">
                <For each={list().slice(0, MOST)} fallback={<p class="ui-muted closet-none">No skin fits.</p>}>
                  {(r) => (
                    <article class="skin" data-have={r.have || undefined}>
                      <span class="thing-pic" data-grade={GRADES[r.skin[2]]} aria-hidden="true">
                        <Show when={r.skin[6]} fallback={<span class="ui-icon">{"\ue771"}</span>}>
                          {(name) => <GameIcon name={name()}><span class="ui-icon">{"\ue771"}</span></GameIcon>}
                        </Show>
                      </span>
                      <div class="skin-text">
                        <b>{r.skin[0]}</b>
                        <small><span data-grade={GRADES[r.skin[2]]}>{GRADE_NAMES[r.skin[2]]}</span> · {slotName(r.skin[3])}{r.skin[1] ? ` · or ${r.skin[1]}` : ""}</small>
                        <small class="skin-from">{r.skin[5].slice(0, 2).join("; ")}{r.skin[5].length > 2 ? `; and ${r.skin[5].length - 2} more` : ""}</small>
                      </div>
                      <Show when={r.have}><span class="skin-have ui-icon" aria-label="In the Closet">{"\ue73e"}</span></Show>
                    </article>
                  )}
                </For>
              </div>
            </section>
          </div>
        )}
      </Show>
    </div>
  );
}
