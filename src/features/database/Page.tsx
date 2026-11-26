import { createMemo, createResource, createSignal, For, Match, Show, Switch, type JSX } from "solid-js";
import { openPage } from "../../api";
import { change } from "../../store";
import { Choices } from "../../ui/Line";
import { GameIcon, Pic } from "../../ui/Pic";
import { GRADES, slotName } from "../closet/logic";
import { closet } from "../closet/watch";
import { gradeOf, itemName } from "../loot/logic";
import { dropFile, dungeonFile, itemFile, mapList, nameFile, petFile, recipeFile, skinFile, worldMap } from "../map/data";
import { droppers, dropsOf, keyOf, type Thing, type WorldMap } from "../map/logic";
import { index, KIND_NAMES, KINDS, search, usedIn, type Entry, type Kind } from "./logic";
import "../loot/loot.css";
import "./database.css";

const quiet = <T,>(p: Promise<T>) => p.catch(() => null);

export function DatabasePage() {
  const [files] = createResource(async () => {
    const [items, names, skins, pets, dungeons] = await Promise.all([quiet(itemFile()), quiet(nameFile()), quiet(skinFile()), quiet(petFile()), quiet(dungeonFile())]);
    return { items, names, skins, pets, dungeons };
  });
  const [drops] = createResource(() => quiet(dropFile()));
  const [recipes] = createResource(() => quiet(recipeFile()));
  // Every map with marks, for where a thing is.
  const [maps] = createResource(async () => {
    const list = (await quiet(mapList()))?.maps.filter((m) => m.marks > 0) ?? [];
    return (await Promise.all(list.map((m) => quiet(worldMap(m.id))))).filter((m): m is WorldMap => !!m);
  });
  const all = createMemo(() => (files() ? index(files()!) : []));
  const [query, setQuery] = createSignal("");
  const [kind, setKind] = createSignal<Kind | "">("");
  const [open, setOpen] = createSignal<Entry>();
  const found = createMemo(() => search(all(), query(), kind()));
  const shown = () => open() ?? found()[0];
  const go = (k: Kind, id: number) => {
    const e = all().find((x) => x.kind === k && x.ids.includes(id));
    if (e) setOpen(e);
  };

  return (
    <div class="page">
      <header class="page-head">
        <h1>Database</h1>
        <input class="ui-input db-search" type="search" placeholder="Search anything, or a number" aria-label="Search anything, or a number" value={query()} onInput={(e) => (setQuery(e.currentTarget.value), setOpen(undefined))} />
      </header>
      <Choices name="Kind" all={[["", "Everything"], ...KINDS.map((k) => [k, KIND_NAMES[k]] as const)] as const} value={kind()} set={(k) => (setKind(k), setOpen(undefined))} />
      <Show when={files() && !files()!.items && !files()!.names} fallback={null}>
        <p class="ui-muted ui-small">Nothing to search: the engine's tools/world.py, items.py, calls.py and db.py write what this page reads.</p>
      </Show>
      <Show when={query().trim()} fallback={<div class="ui-empty"><p>{files.loading ? "Reading what is known." : `${all().length.toLocaleString("en-GB")} things to search: items, monsters, skills, effects, skins, pets and dungeons.`}</p></div>}>
        <div class="db-main">
          <div class="db-list" role="listbox" aria-label="Found">
            <Show when={found().length} fallback={<p class="ui-muted ui-small">Nothing found.</p>}>
              <For each={found()}>
                {(e) => (
                  <button class="ui-row-item db-row" role="option" aria-selected={shown() === e} onClick={() => setOpen(e)}>
                    <span data-grade={e.kind === "item" || e.kind === "skin" ? gradeName(e) : undefined}>{e.name}</span>
                    <small class="ui-muted">{KIND_NAMES[e.kind].replace(/s$/, "")}{e.more ? `, ${e.more}` : ""}</small>
                  </button>
                )}
              </For>
            </Show>
          </div>
          <Show when={shown()}>
            {(e) => (
              <section class="block db-card">
                <header class="db-head">
                  <Picture of={e()} icon={files()?.items?.items[e().ids[0]]?.[2]} />
                  <div>
                    <h2 data-grade={e().kind === "item" || e().kind === "skin" ? gradeName(e()) : undefined}>{e().name}</h2>
                    <small class="ui-muted">{KIND_NAMES[e().kind].replace(/s$/, "")}{e().more ? `, ${e().more}` : ""}, number {e().ids.slice(0, 4).join(", ")}{e().ids.length > 4 ? ` and ${e().ids.length - 4} more` : ""}</small>
                  </div>
                </header>
                <Switch>
                  <Match when={e().kind === "item"}>
                    <ItemCard id={e().ids[0]} />
                  </Match>
                  <Match when={e().kind === "monster"}>
                    <Part name="Drops" of={e().ids.flatMap((id) => (drops() ? dropsOf(drops()!, id) : [])).filter((d, i, a) => a.findIndex((x) => x.item === d.item) === i).slice(0, 30)}>
                      {(d) => <Link onClick={() => go("item", d.item)} grade={GRADES[d.grade]} name={d.name} more={`${chance(d.chance)}`} />}
                    </Part>
                    <Where things={(m) => m.things.filter((t) => t.npc !== undefined && e().ids.includes(t.npc))} />
                  </Match>
                  <Match when={e().kind === "skin"}>
                    {(() => {
                      const s = () => files()?.skins?.skins[e().ids[0]];
                      return (
                        <Show when={s()}>
                          {(x) => (
                            <>
                              <p>{slotName(x()[3])}{x()[1] ? `; for Asmodians ${x()[1]}` : ""}. {closet().ids.includes(e().ids[0]) ? "In your Closet." : "Not in your Closet, as last said."}</p>
                              <Part name="Comes from" of={x()[5]}>{(w) => <div class="ui-row-item"><span>{w}</span></div>}</Part>
                            </>
                          )}
                        </Show>
                      );
                    })()}
                  </Match>
                  <Match when={e().kind === "pet"}>
                    <p class="ui-muted">Its souls, where they drop, and your progress are on the Pets page.</p>
                    <button class="ui-button" onClick={() => void openPage("pets")}>Open Pets</button>
                  </Match>
                  <Match when={e().kind === "skill"}>
                    <p class="ui-muted">{e().ids.length > 1 ? `${e().ids.length} numbers under this name: ranks, or the same skill of other classes or monsters.` : "One number under this name."}</p>
                  </Match>
                  <Match when={e().kind === "dungeon"}>
                    <p class="ui-muted">Its runs are on the History page, with this name on each card.</p>
                  </Match>
                </Switch>
              </section>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );

  function gradeName(e: Entry) {
    return e.grade === undefined ? undefined : e.kind === "skin" ? GRADES[e.grade] : gradeOf(files()?.items, e.ids[0]) || undefined;
  }

  function ItemCard(props: { id: number }) {
    const recipe = () => recipes()?.recipes[props.id];
    const madeFrom = () => Object.entries(recipes()?.recipes ?? {}).find(([, r]) => r.better === String(props.id));
    const name = (id: number | string) => itemName(files()?.items, Number(id));
    const grade = (id: number | string) => gradeOf(files()?.items, Number(id)) || undefined;
    return (
      <>
        <Part name="Made of" of={recipe()?.of ?? []}>{([id, n]) => <Link onClick={() => go("item", Number(id))} grade={grade(id)} name={name(id)} more={`${n}`} />}</Part>
        <Show when={recipe()?.better}>{(b) => <Part name="Made better into" of={[b()]}>{(id) => <Link onClick={() => go("item", Number(id))} grade={grade(id)} name={name(id)} />}</Part>}</Show>
        <Show when={madeFrom()}>{(m) => <Part name="Made better from" of={[m()[0]]}>{(id) => <Link onClick={() => go("item", Number(id))} grade={grade(id)} name={name(id)} />}</Part>}</Show>
        <Part name="Part of" of={recipes() ? usedIn(recipes()!, props.id).filter((id, i, all) => all.findIndex((x) => name(x) === name(id)) === i) : []}>{(id) => <Link onClick={() => go("item", id)} grade={grade(id)} name={name(id)} />}</Part>
        <Part name="Dropped by" of={drops() ? droppers(drops()!, props.id).slice(0, 30) : []}>{(d) => <Link onClick={() => go("monster", d.npc)} name={d.name} more={chance(d.chance)} />}</Part>
        <Where name="Gathered" things={(m) => m.things.filter((t) => t.layer === "gather" && t.items?.includes(props.id))} />
      </>
    );
  }

  /** The maps a thing is on, each with a button that opens the map with it tracked. */
  function Where(props: { name?: string; things: (m: WorldMap) => Thing[] }) {
    const places = createMemo(() => (maps() ?? []).flatMap((m) => props.things(m).map((t) => ({ m, t }))).slice(0, 20));
    const show = (m: WorldMap, t: Thing) => {
      change((s) => {
        s.world.map = m.id;
        s.world.tracked = [...new Set([...s.world.tracked, keyOf(m.id, t)])];
      });
      void openPage("map");
    };
    return (
      <Part name={props.name ?? "On the map"} of={places()}>
        {(p) => (
          <div class="ui-row-item">
            <span>{p.t.name} <small class="ui-muted">{p.m.name}{p.t.level ? `, level ${p.t.level}` : ""}, {p.t.spots.length / 5} {p.t.spots.length === 5 ? "spot" : "spots"}</small></span>
            <button class="ui-chip" onClick={() => show(p.m, p.t)}>Show on the map</button>
          </div>
        )}
      </Part>
    );
  }
}

const chance = (c: number) => (c >= 1 ? `${+c.toFixed(1)}%` : `${+c.toPrecision(2)}%`);

function Part<T>(props: { name: string; of: readonly T[]; children: (x: T) => JSX.Element }) {
  return (
    <Show when={props.of.length}>
      <h3 class="db-part">{props.name}</h3>
      <For each={props.of as T[]}>{(x) => props.children(x)}</For>
    </Show>
  );
}

function Link(props: { name: string; grade?: string; more?: string; onClick: () => void }) {
  return (
    <button class="ui-row-item" onClick={props.onClick}>
      <span data-grade={props.grade}>{props.name}</span>
      <small class="ui-muted ui-num">{props.more ?? ""}</small>
    </button>
  );
}

function Picture(props: { of: Entry; icon?: string }) {
  return (
    <span class="db-pic" aria-hidden="true">
      <Switch fallback={<b>{props.of.name[0]}</b>}>
        <Match when={(props.of.kind === "item") && props.icon}>{(icon) => <GameIcon name={icon()}><b>{props.of.name[0]}</b></GameIcon>}</Match>
        <Match when={props.of.kind === "skill"}><Pic skill={props.of.ids[0]} name={props.of.name} large /></Match>
        <Match when={props.of.kind === "effect"}><Pic effect={props.of.ids[0]} name={props.of.name} large /></Match>
      </Switch>
    </span>
  );
}
