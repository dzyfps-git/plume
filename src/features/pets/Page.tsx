import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { openPage } from "../../api";
import { change, settings } from "../../store";
import { GOALS } from "../../store/settings";
import { Choices } from "../../ui/Line";
import { mapList, petFile, pictureOf } from "../map/data";
import { counts, CRYSTALS, done, KIND_NAMES, KINDS, SOURCE_NAMES, SOURCES, sources, toGo, type Kind, type Pet, type Source, type Where } from "./logic";
import "./pets.css";

const SHOW = [["needed", "Needed"], ["all", "All"], ["done", "Done"]] as const;
const ORDER = [["close", "Closest to done"], ["souls", "Fewest souls to go"], ["name", "Name"]] as const;

export function PetsPage() {
  const [file] = createResource(() => petFile().catch(() => null));
  const [faces] = createResource(() => pictureOf("pets").catch(() => null));
  const [maps] = createResource(() => mapList().catch(() => null));
  const [kind, setKind] = createSignal<Kind | "">("");
  const [source, setSource] = createSignal<Source | "">("");
  const [show, setShow] = createSignal<(typeof SHOW)[number][0]>("needed");
  const [order, setOrder] = createSignal<(typeof ORDER)[number][0]>("close");
  const [query, setQuery] = createSignal("");
  const level = (p: Pet) => settings.pets.levels[p.id] ?? 0;
  const souls = (p: Pet) => settings.pets.souls[p.id] ?? 0;
  const left = (p: Pet) => toGo(p, level(p), souls(p), settings.pets.goal);
  const reached = (p: Pet) => (p.kind === "special" ? level(p) > 0 : left(p) === 0);

  const rows = createMemo(() => {
    const all = (file()?.pets ?? []).filter((p) =>
      (!kind() || p.kind === kind()) &&
      (!source() || sources(p).includes(source() as Source)) &&
      (show() === "all" || (show() === "done") === reached(p)) &&
      (!query() || p.name.toLowerCase().includes(query().toLowerCase()) || p.where.some((w) => w.name.toLowerCase().includes(query().toLowerCase()))),
    );
    const by = {
      close: (a: Pet, b: Pet) => done(b, level(b), souls(b), settings.pets.goal) - done(a, level(a), souls(a), settings.pets.goal) || left(a) - left(b),
      souls: (a: Pet, b: Pet) => left(a) - left(b),
      name: () => 0,
    }[order()];
    // Special pets cannot be farmed, so they come last.
    const special = (p: Pet) => Number(p.kind === "special");
    return all.sort((a, b) => special(a) - special(b) || by(a, b) || a.name.localeCompare(b.name));
  });
  const had = () => counts(file()?.pets ?? [], settings.pets.levels);
  const told = () =>
    settings.pets.told
      ? `The game said them on ${new Date(settings.pets.told).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}, and each soul since.`
      : "Typed in by hand. The game says them all as you log in with live data on.";

  /** Opens the map where its souls drop, with those monsters tracked. */
  const farm = (w: Where) => {
    change((s) => {
      s.world.map = w.map;
      s.world.tracked = [...new Set([...s.world.tracked, `${w.map}/monster:${w.npc}`, `${w.map}/boss:${w.npc}`])];
    });
    void openPage("map");
  };
  const onMap = (w: Where) => maps()?.maps.some((m) => m.id === w.map && m.marks > 0) ?? false;

  return (
    <div class="page">
      <header class="page-head">
        <h1>Pets</h1>
        <Choices name="Goal" all={GOALS.map((g) => [g, `Level ${g}`] as const)} value={settings.pets.goal} set={(g) => change((s) => (s.pets.goal = g))} />
      </header>
      <Show when={file()} fallback={<div class="ui-empty"><p>{file.loading ? "Reading the pets." : "The pet file is not on this PC. The engine's tools/world.py writes it."}</p></div>}>
        {(f) => (
          <>
            <div class="stats">
              <For each={[1, 2, 3]}>{(l, i) => <div class="stat" data-goal={l === settings.pets.goal || undefined}><small>Level {l}</small><b class="ui-num">{had()[i()]} of {f().pets.length}</b></div>}</For>
              <div class="stat"><small>Crystals at {CRYSTALS}</small><b class="ui-num">{Math.min(had()[0], CRYSTALS)} of {CRYSTALS}</b></div>
            </div>
            <p class="ui-muted ui-small pets-told">{told()}</p>
            <div class="pets-filters">
              <input class="ui-input" type="search" placeholder="Search a pet or a monster" aria-label="Search a pet or a monster" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
              <Choices name="Show" all={SHOW} value={show()} set={setShow} />
              <Choices name="Kind" all={[["", "Every kind"], ...KINDS.map((k) => [k, KIND_NAMES[k]] as const)] as const} value={kind()} set={setKind} />
              <Choices name="Where" all={[["", "Anywhere"], ...SOURCES.map((s) => [s, SOURCE_NAMES[s]] as const)] as const} value={source()} set={setSource} />
              <Choices name="Order" all={ORDER} value={order()} set={setOrder} />
            </div>
            <p class="ui-muted ui-small">{rows().length} shown.</p>
            <div class="pets-list">
              <For each={rows()}>
                {(p) => (
                  <article class="pet" data-done={reached(p) || undefined}>
                    <Face pet={p} sheet={faces()} cell={f().faces.cell} columns={f().faces.columns} />
                    <div class="pet-main">
                      <b>{p.name} <small class="ui-muted">{KIND_NAMES[p.kind]}{p.soon ? ", not in the game yet" : ""}</small></b>
                      <small class="ui-muted">{sources(p).map((s) => SOURCE_NAMES[s]).join(", ")}</small>
                      <div class="pet-bar" style={{ "--done": done(p, level(p), souls(p), settings.pets.goal) }} />
                      <Show when={p.kind !== "special"} fallback={<small class="pet-how">{p.how}</small>}>
                        <small class="ui-num">{left(p) ? `${left(p)} souls to level ${settings.pets.goal}` : `Level ${settings.pets.goal} reached`}</small>
                      </Show>
                      <Show when={p.where.length}>
                        <ul class="pet-where">
                          <For each={p.where.slice().sort((a, b) => a.level - b.level)}>
                            {(w) => (
                              <li>
                                <span>{w.name} <small class="ui-muted">{w.level}, {w.at}{w.zones.length ? `: ${w.zones.slice(0, 3).join(", ")}` : ""}</small></span>
                                <Show when={onMap(w)}><button class="ui-chip" onClick={() => farm(w)}>Farm here</button></Show>
                              </li>
                            )}
                          </For>
                        </ul>
                      </Show>
                      <Show when={p.how && p.kind !== "special"}><small class="pet-how">{p.how}</small></Show>
                    </div>
                    <div class="pet-mine">
                      <Choices name={`Level of ${p.name}`} all={[0, 1, 2, 3].map((n) => [n, String(n)] as const)} value={level(p)}
                        set={(n) => change((s) => (s.pets.levels = { ...s.pets.levels, [p.id]: n }))} />
                      <Show when={p.kind !== "special"}>
                        <label class="pet-souls">
                          <small class="ui-muted">Souls</small>
                          <input class="ui-input ui-num" type="number" min="0" max="100000" aria-label={`Souls of ${p.name}`} value={souls(p)}
                            onChange={(e) => change((s) => (s.pets.souls = { ...s.pets.souls, [p.id]: Math.max(0, Math.round(e.currentTarget.valueAsNumber || 0)) }))} />
                        </label>
                      </Show>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}

/** A pet's face from the sheet, or its first letter. */
function Face(props: { pet: Pet; sheet?: ImageBitmap | null; cell: number; columns: number }) {
  const paint = (canvas: HTMLCanvasElement) => {
    const face = props.pet.face ?? 0;
    const c = props.cell;
    // Before drawing: setting a size empties a canvas.
    canvas.width = canvas.height = c;
    canvas.getContext("2d")?.drawImage(props.sheet!, (face % props.columns) * c, Math.floor(face / props.columns) * c, c, c, 0, 0, c, c);
  };
  return (
    <span class="pet-face" aria-hidden="true">
      <Show when={props.pet.face !== undefined && props.sheet} fallback={<b>{props.pet.name[0]}</b>}>
        <canvas ref={paint} />
      </Show>
    </span>
  );
}
