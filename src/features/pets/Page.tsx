import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { openPage } from "../../api";
import { change, settings } from "../../store";
import { GOALS } from "../../store/settings";
import { GameIcon } from "../../ui/Pic";
import { flip } from "../../ui/sets";
import { itemFile, mapList, petFile, pictureOf } from "../map/data";
import { LAYER_COLOURS } from "../map/logic";
import { counts, CRYSTALS, done, fits, KIND_NAMES, KINDS, NEEDED, SOURCE_NAMES, SOURCES, sources, toGo, type Kind, type Pet, type Source, type Where } from "./logic";
import "./pets.css";

/** The game's own picture for each kind. */
const KIND_ICONS: Record<Kind, string> = { cogni: "site_Creature_Intellect", fera: "site_Creature_Feral", natura: "site_Creature_Nature", varian: "site_Creature_Trans", special: "site_Creature_Special" };

const SHOW = [["needed", "Needed"], ["all", "All"], ["done", "Done"]] as const;
const ORDER = [["close", "Closest to done"], ["souls", "Fewest souls to go"], ["name", "Name"]] as const;
const HELP = "pets-help-closed";
/** A colour for each place: the side's own, the map's colour for dungeons, and quiet ones for the rest. */
const WHERE_TINT: Record<Source, string> = {
  elyos: "var(--side-elyos)", asmodian: "var(--side-asmodian)", abyss: "var(--side-abyss)", dungeon: LAYER_COLOURS.dungeon,
  chest: "var(--grade-unique)", market: "var(--grade-epic)", shop: "var(--grade-special)", other: "var(--text-muted)",
};


export function PetsPage() {
  const [file] = createResource(() => petFile().catch(() => null));
  const [items] = createResource(() => itemFile().catch(() => null));
  const [faces] = createResource(() => pictureOf("pets").catch(() => null));
  const [maps] = createResource(() => mapList().catch(() => null));
  const [kinds, setKinds] = createSignal<ReadonlySet<Kind>>(new Set());
  const [from, setFrom] = createSignal<ReadonlySet<Source>>(new Set());
  const none = new Set<never>();
  const [show, setShow] = createSignal<(typeof SHOW)[number][0]>("needed");
  const [order, setOrder] = createSignal<(typeof ORDER)[number][0]>("close");
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal(0);
  const [help, setHelp] = createSignal(!localStorage.getItem(HELP));
  const goal = () => settings.pets.goal;
  const level = (p: Pet) => settings.pets.levels[p.id] ?? 0;
  const souls = (p: Pet) => settings.pets.souls[p.id] ?? 0;
  const left = (p: Pet) => toGo(p, level(p), souls(p), goal());
  const reached = (p: Pet) => (p.kind === "special" ? level(p) > 0 : left(p) === 0);
  const all = () => file()?.pets ?? [];
  // Everything counts only the pets chosen on the left; each filter's own counts leave out its own choice.
  const chosen = createMemo(() => all().filter((p) => fits(p, kinds(), from())));
  const farmed = createMemo(() => chosen().filter((p) => p.kind !== "special" && !p.soon));
  const had = () => counts(farmed(), settings.pets.levels);
  const needed = createMemo(() => farmed().filter((p) => left(p) > 0));
  const ofKind = (k: Kind) => all().filter((p) => p.kind === k && fits(p, none, from()));
  const ofPlace = (s: Source) => all().filter((p) => fits(p, kinds(), new Set([s])));
  const picking = () => kinds().size > 0 || from().size > 0;

  const rows = createMemo(() => {
    const words = query().trim().toLowerCase();
    const list = chosen().filter((p) =>
      (show() === "all" || (show() === "done") === reached(p)) &&
      (!words || p.name.toLowerCase().includes(words) || p.where.some((w) => w.name.toLowerCase().includes(words) || w.at.toLowerCase().includes(words))),
    );
    const by = {
      close: (a: Pet, b: Pet) => done(b, level(b), souls(b), goal()) - done(a, level(a), souls(a), goal()) || left(a) - left(b),
      souls: (a: Pet, b: Pet) => left(a) - left(b),
      name: () => 0,
    }[order()];
    // Special pets cannot be farmed, so they come last.
    const special = (p: Pet) => Number(p.kind === "special");
    return list.sort((a, b) => special(a) - special(b) || by(a, b) || a.name.localeCompare(b.name));
  });
  const told = () =>
    settings.pets.told
      ? `The game said them on ${new Date(settings.pets.told).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}, and each soul since.`
      : "Typed in by hand until the game says them, as you log in with live data on.";

  /** Opens the map where its souls drop, with those monsters tracked. */
  const farm = (w: Where) => {
    change((s) => {
      s.world.map = w.map;
      s.world.tracked = [...new Set([...s.world.tracked, `${w.map}/monster:${w.npc}`, `${w.map}/boss:${w.npc}`])];
    });
    void openPage("map");
  };
  const onMap = (w: Where) => maps()?.maps.some((m) => m.id === w.map && m.marks > 0) ?? false;
  const setLevel = (p: Pet, n: number) => change((s) => (s.pets.levels = { ...s.pets.levels, [p.id]: n }));
  const icon = (p: Pet) => (p.market ? items()?.items[String(p.market)]?.[2] : undefined);
  const closeHelp = () => {
    localStorage.setItem(HELP, "1");
    setHelp(false);
  };

  return (
    <div class="page pets-page">
      <header class="page-head">
        <h1>Pets</h1>
        <small class="ui-muted pets-told">{told()}</small>
      </header>
      <Show when={file()} fallback={<div class="ui-empty"><p>{file.loading ? "Reading the pets." : "The pet file is not on this PC. The engine's tools/world.py writes it."}</p></div>}>
        {(f) => (
          <>
            <Show when={help()}>
              <section class="block pets-help" aria-label="How pets work">
                <h2>
                  <span class="ui-icon" aria-hidden="true">{"\ueb51"}</span>
                  How pets work
                  <button class="ui-icon-button" aria-label="Close" onClick={closeHelp}>{"\ue8bb"}</button>
                </h2>
                <ol>
                  <li><b>Kill a pet's monster for its souls.</b> {NEEDED[0]} souls get the pet, {NEEDED[1]} more take it to level 2 and {NEEDED[2]} more to level 3. Each level adds to your stats.</li>
                  <li><b>Every pet first, then the next level.</b> Choose the level you are working to on the left: the list shows what each pet still needs for it.</li>
                  <li><b>Farm on the map.</b> The map button opens the map with that pet's monsters tracked.</li>
                </ol>
              </section>
            </Show>
            <div class="pets-grid">
              <aside class="side-filters" aria-label="Choose pets">
                <h3>Working to</h3>
                <For each={GOALS}>
                  {(g) => (
                    <button class="side-row" role="radio" aria-checked={goal() === g} onClick={() => change((s) => (s.pets.goal = g))}>
                      <span class="side-radio" aria-hidden="true" />
                      <span>Level {g}</span>
                      <small class="ui-num">{had()[g - 1]}/{farmed().length}</small>
                    </button>
                  )}
                </For>
                <h3>
                  Kind
                  <Show when={picking()}><button class="side-reset" onClick={() => (setKinds(none), setFrom(none))}>Reset</button></Show>
                </h3>
                <For each={KINDS}>
                  {(k) => (
                    <button class="side-row" data-kind={k} role="checkbox" aria-checked={kinds().has(k)} onClick={() => setKinds(flip(kinds(), k))}>
                      <span class="side-check" aria-hidden="true" />
                      <span class="tint-text"><span class="kind-pic" aria-hidden="true"><GameIcon name={KIND_ICONS[k]}>{null}</GameIcon></span>{KIND_NAMES[k]}</span>
                      <small class="ui-num">{ofKind(k).filter(reached).length}/{ofKind(k).length}</small>
                    </button>
                  )}
                </For>
                <h3>Where</h3>
                <For each={SOURCES}>
                  {(s) => (
                    <button class="side-row" style={{ "--tint": WHERE_TINT[s] }} role="checkbox" aria-checked={from().has(s)} disabled={!ofPlace(s).length && !from().has(s)} onClick={() => setFrom(flip(from(), s))}>
                      <span class="side-check" aria-hidden="true" />
                      <span>{SOURCE_NAMES[s]}</span>
                      <small class="ui-num">{ofPlace(s).filter(reached).length}/{ofPlace(s).length}</small>
                    </button>
                  )}
                </For>
                <h3>Collection</h3>
                <div class="side-fact"><span>Collected</span><b class="ui-num">{counts(all(), settings.pets.levels)[0]}/{f().pets.length}</b></div>
                <div class="side-fact"><span>Soul crystals</span><b class="ui-num">{Math.min(counts(all(), settings.pets.levels)[0], CRYSTALS)}/{CRYSTALS}</b></div>
              </aside>

              <section class="pets-main">
                <div class="pets-sum">
                  <span class="ui-icon" aria-hidden="true">{"\ueb51"}</span>
                  <span>
                    <b>{picking() ? "The chosen pets" : "Every pet"} to level {goal()}</b>
                    <span class="ui-muted"> · </span>
                    <b class="ui-num">{needed().length}</b> pets to go
                    <span class="ui-muted"> · </span>
                    <b class="ui-num pets-souls-left">{needed().reduce((n, p) => n + left(p), 0).toLocaleString("en-GB")}</b> souls
                  </span>
                  <i class="tint-bar" style={{ "--done": farmed().length ? 1 - needed().length / farmed().length : 0 }} />
                  <small class="ui-num ui-muted">{farmed().length - needed().length}/{farmed().length}</small>
                </div>
                <div class="pets-tools">
                  <input class="ui-input" type="search" placeholder="Search a pet, a monster or a place" aria-label="Search a pet, a monster or a place" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
                  <select class="ui-select" aria-label="Which pets" value={show()} onChange={(e) => setShow(e.currentTarget.value as (typeof SHOW)[number][0])}>
                    <For each={SHOW}>{([v, name]) => <option value={v}>{name}</option>}</For>
                  </select>
                  <select class="ui-select" aria-label="Order" value={order()} onChange={(e) => setOrder(e.currentTarget.value as (typeof ORDER)[number][0])}>
                    <For each={ORDER}>{([v, name]) => <option value={v}>{name}</option>}</For>
                  </select>
                </div>
                <div class="pets-table" role="table" aria-label="Pets">
                  <div class="pets-head" role="row">
                    <span role="columnheader">Pet</span>
                    <span role="columnheader">Level</span>
                    <span role="columnheader">Souls</span>
                    <span role="columnheader">Monster</span>
                    <span role="columnheader">Where</span>
                    <span />
                  </div>
                  <For each={rows()} fallback={<p class="ui-muted pets-none">No pet fits. Reset the choices on the left.</p>}>
                    {(p) => {
                      const first = () => p.where.slice().sort((a, b) => a.level - b.level)[0];
                      const need = () => NEEDED[Math.min(level(p), 2)];
                      return (
                        <div class="pet-row" role="row" data-kind={p.kind} data-done={reached(p) || undefined} data-open={open() === p.id || undefined}>
                          <button class="pet-who" aria-expanded={open() === p.id} onClick={() => setOpen(open() === p.id ? 0 : p.id)}>
                            <Portrait pet={p} icon={icon(p)} sheet={faces()} cell={f().faces.cell} columns={f().faces.columns} />
                            <span class="pet-name">
                              <b>{p.name}</b>
                              <small><span class="tint-dot" aria-hidden="true" /> <span class="tint-text">{KIND_NAMES[p.kind]}</span>{p.soon ? ", not in the game yet" : ""}</small>
                            </span>
                          </button>
                          <span class="pet-pips" role="radiogroup" aria-label={`Level of ${p.name}`}>
                            <For each={[1, 2, 3]}>
                              {(n) => <button role="radio" aria-checked={level(p) === n} data-filled={level(p) >= n || undefined} aria-label={`Level ${n}`} onClick={() => setLevel(p, level(p) === n ? n - 1 : n)} />}
                            </For>
                          </span>
                          <span class="pet-souls">
                            <Show when={p.kind !== "special"} fallback={<small class="ui-muted">Not farmed</small>}>
                              <Show when={level(p) < 3} fallback={<small class="tint-text">All levels</small>}>
                                <span class="ui-num"><b>{Math.min(souls(p), need())}</b><small class="ui-muted"> / {need()}</small></span>
                                <i class="tint-bar" style={{ "--done": Math.min(1, souls(p) / need()) }} />
                              </Show>
                            </Show>
                          </span>
                          <span class="pet-monster">
                            <Show when={first()} fallback={<small class="ui-muted">{p.how ? "See below" : "None known"}</small>}>
                              {(w) => <>{w().name} <small class="ui-muted">Lv. {w().level}</small></>}
                            </Show>
                          </span>
                          <span class="pet-at ui-muted">{[...new Set(p.where.map((w) => w.at))].join(", ") || sources(p).map((s) => SOURCE_NAMES[s]).join(", ")}</span>
                          <span>
                            <Show when={first() && onMap(first()!)}>
                              <button class="ui-icon-button" aria-label={`Farm ${p.name} on the map`} onClick={() => farm(first()!)}>{"\ue909"}</button>
                            </Show>
                          </span>
                          <Show when={open() === p.id}>
                            <div class="pet-more">
                              <Show when={p.where.length}>
                                <ul class="pet-where">
                                  <For each={p.where.slice().sort((a, b) => a.level - b.level)}>
                                    {(w) => (
                                      <li>
                                        <span>{w.name} <small class="ui-muted">Lv. {w.level}, {w.at}{w.zones.length ? `: ${w.zones.slice(0, 3).join(", ")}` : ""}</small></span>
                                        <Show when={onMap(w)}><button class="ui-chip" onClick={() => farm(w)}>Farm here</button></Show>
                                      </li>
                                    )}
                                  </For>
                                </ul>
                              </Show>
                              <Show when={p.how}><p class="ui-muted ui-small">{p.how}</p></Show>
                              <Show when={p.kind !== "special"}>
                                <label class="pet-souls-input">
                                  <small class="ui-muted">Souls toward the next level</small>
                                  <input class="ui-input ui-num" type="number" min="0" max="100000" aria-label={`Souls of ${p.name}`} value={souls(p)}
                                    onChange={(e) => change((s) => (s.pets.souls = { ...s.pets.souls, [p.id]: Math.max(0, Math.round(e.currentTarget.valueAsNumber || 0)) }))} />
                                </label>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </section>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}

/** A pet's picture: its Market item's, or its face from the sheet, or its first letter. */
function Portrait(props: { pet: Pet; icon?: string; sheet?: ImageBitmap | null; cell: number; columns: number }) {
  const paint = (canvas: HTMLCanvasElement) => {
    const face = props.pet.face ?? 0;
    const c = props.cell;
    // Before drawing: setting a size empties a canvas.
    canvas.width = canvas.height = c;
    canvas.getContext("2d")?.drawImage(props.sheet!, (face % props.columns) * c, Math.floor(face / props.columns) * c, c, c, 0, 0, c, c);
  };
  const face = () => (
    <Show when={props.pet.face !== undefined && props.sheet} fallback={<b>{props.pet.name[0]}</b>}>
      <canvas ref={paint} />
    </Show>
  );
  return (
    <span class="thing-pic" data-kind={props.pet.kind} aria-hidden="true">
      <Show when={props.icon} fallback={face()}>{(name) => <GameIcon name={name()}>{face()}</GameIcon>}</Show>
    </span>
  );
}
