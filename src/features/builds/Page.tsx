import { createMemo, createResource, createSignal, For, Index, Show } from "solid-js";
import { Pic } from "../../ui/Pic";
import { boardFile, nameFile } from "../map/data";
import { canTake, columnOf, letGo, middle, rowOf, SIDE, statWords, sums, type Board, type Build } from "./logic";
import "./builds.css";

/** Your builds, on this PC. */
const KEY = "builds";
function read(): Build[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Build[];
    return Array.isArray(v) ? v.filter((b) => b && typeof b.name === "string" && typeof b.job === "string" && b.taken && typeof b.taken === "object") : [];
  } catch {
    return [];
  }
}
const [builds, setBuilds] = createSignal<Build[]>(read());
addEventListener("storage", (e) => e.key === KEY && setBuilds(read()));
const save = (all: Build[]) => {
  setBuilds(all);
  localStorage.setItem(KEY, JSON.stringify(all));
};

export function BuildsPage() {
  const [file] = createResource(() => boardFile().catch(() => null));
  const [names] = createResource(() => nameFile().catch(() => null));
  const [at, setAt] = createSignal(0);
  const [boardAt, setBoardAt] = createSignal(0);
  const [job, setJob] = createSignal("");
  const build = () => builds()[at()];
  const boards = () => (build() && file()?.boards[build()!.job]) || [];
  const board = () => boards()[Math.min(boardAt(), boards().length - 1)];
  const skillName = (id: number) => names()?.skills[id] ?? `Skill ${id}`;
  const given = createMemo(() => (build() ? sums(boards(), build()!) : { stats: [], skills: [] }));

  const change = (next: Build) => save(builds().map((b, i) => (i === at() ? next : b)));
  const make = () => {
    const j = job() || Object.keys(file()?.boards ?? {})[0];
    if (!j) return;
    save([...builds(), { name: `${j} ${builds().filter((b) => b.job === j).length + 1}`, job: j, taken: {} }]);
    setAt(builds().length - 1);
    setBoardAt(0);
  };
  const remove = () => {
    save(builds().filter((_, i) => i !== at()));
    setAt(Math.max(0, at() - 1));
  };
  const press = (b: Board, place: number) => {
    const now = build()!;
    const taken = now.taken[b.id] ?? [];
    const next = taken.includes(place) ? letGo(b, taken, place) : canTake(b, taken, place) ? [...taken, place] : taken;
    if (next !== taken) change({ ...now, taken: { ...now.taken, [b.id]: next } });
  };

  return (
    <div class="page">
      <header class="page-head">
        <h1>Builds</h1>
        <Show when={file()}>
          {(f) => (
            <div class="ui-row">
              <select class="ui-select" aria-label="Class of a new build" value={job()} onChange={(e) => setJob(e.currentTarget.value)}>
                <For each={Object.keys(f().boards)}>{(j) => <option value={j}>{j}</option>}</For>
              </select>
              <button class="ui-button" onClick={make}>New build</button>
            </div>
          )}
        </Show>
      </header>
      <Show when={file()} fallback={<div class="ui-empty"><p>{file.loading ? "Reading the boards." : "The board file is not on this PC. The engine's tools/db.py writes it."}</p></div>}>
        <Show when={build()} fallback={<div class="ui-empty"><p>No builds yet. Choose a class and make one.</p><p class="ui-small">Boards of eight classes are known; the Fighter's are not.</p></div>}>
          {(b) => (
            <>
              <div class="ui-row builds-top">
                <select class="ui-select" aria-label="Build" value={at()} onChange={(e) => (setAt(Number(e.currentTarget.value)), setBoardAt(0))}>
                  <For each={builds()}>{(x, i) => <option value={i()}>{x.name.startsWith(x.job) ? x.name : `${x.name}, ${x.job}`}</option>}</For>
                </select>
                <input class="ui-input" aria-label="Name of the build" value={b().name} maxLength={60} onChange={(e) => change({ ...b(), name: e.currentTarget.value.trim() || b().name })} />
                <button class="ui-button" onClick={() => change({ ...b(), taken: {} })}>Start again</button>
                <button class="ui-button" onClick={remove}>Delete</button>
              </div>
              <div class="ui-row" role="tablist" aria-label="Board">
                <Index each={boards()}>
                  {(x, i) => (
                    <button class="ui-chip" role="tab" aria-selected={board()?.id === x().id} onClick={() => setBoardAt(i)}>
                      Board {i + 1} <small class="ui-num ui-muted">{(b().taken[x().id] ?? []).length}</small>
                    </button>
                  )}
                </Index>
              </div>
              <div class="builds-main">
                <Show when={board()}>
                  {(x) => (
                    <div class="board" style={{ "--side": SIDE }} role="group" aria-label={`Board ${boardAt() + 1}`}>
                      <For each={x().nodes}>
                        {(n) => {
                          const taken = () => n[0] === middle(x()) || (b().taken[x().id] ?? []).includes(n[0]);
                          const can = () => canTake(x(), b().taken[x().id] ?? [], n[0]);
                          const what = typeof n[2] === "number" ? skillName(n[2]) : n[2] ? statWords(n[2]) : "The middle";
                          return (
                            <button
                              class="node"
                              style={{ "grid-row": rowOf(n[0]) + 1, "grid-column": columnOf(n[0]) + 1 }}
                              data-grade={n[1].toLowerCase()}
                              data-taken={taken() || undefined}
                              data-can={can() || undefined}
                              aria-pressed={taken()}
                              aria-label={`${what}, ${n[1] === "None" ? "always taken" : n[1].toLowerCase()}`}
                              disabled={n[1] === "None"}
                              onClick={() => press(x(), n[0])}
                            >
                              <Show when={typeof n[2] === "number"}><Pic skill={n[2] as number} name={what} /></Show>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  )}
                </Show>
                <section class="block builds-sum">
                  <h2>What it gives</h2>
                  <p class="ui-muted ui-small">Nodes taken on every board. How much each node gives is not in the data, so stats are counted by nodes.</p>
                  <Show when={given().skills.length || given().stats.length} fallback={<p class="ui-muted ui-small">Nothing taken yet. Take nodes from the middle outwards.</p>}>
                    <For each={given().skills}>{(s) => <div class="ui-row-item"><span><Pic skill={s} name={skillName(s)} /> {skillName(s)}</span><small class="ui-muted">Skill</small><span /></div>}</For>
                    <For each={given().stats}>{([s, n]) => <div class="ui-row-item"><span>{statWords(s)}</span><b class="ui-num">{n}</b><small class="ui-muted">{n === 1 ? "node" : "nodes"}</small></div>}</For>
                  </Show>
                </section>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
