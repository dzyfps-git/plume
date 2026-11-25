import { createMemo, createResource, createSignal, onCleanup } from "solid-js";
import { worldFile } from "../../api";
import { place } from "../../live/store";
import type { Position } from "../../live/types";
import type { PetFile } from "../pets/logic";
import type { CallFile } from "../calls/logic";
import { guess, type Drops, type MapInfo, type WorldMap } from "./logic";

/** Each file is read once a window. One that could not be read is tried again next time. */
const read = new Map<string, Promise<unknown>>();
function once<T>(name: string, make: (bytes: ArrayBuffer) => T | Promise<T>): Promise<T> {
  let got = read.get(name) as Promise<T> | undefined;
  if (!got) {
    got = worldFile(name).then(make);
    got.catch(() => read.delete(name));
    read.set(name, got);
  }
  return got;
}
const json = <T>(name: string) => once(`${name}.json`, (b) => JSON.parse(new TextDecoder().decode(b)) as T);

export const mapList = () => json<{ made: string; maps: MapInfo[] }>("index");
export const worldMap = (id: number) => json<WorldMap>(`map_${id}`);
export const dropFile = () => json<Drops>("drops");
export const petFile = () => json<PetFile>("pets");
export const callFile = () => json<CallFile>("calls");
/** A dungeon's name and how hard, by the game's number. */
export const dungeonFile = () => json<Record<string, [string, string]>>("dungeons");
export const pictureOf = (name: string) => once(`${name}.webp`, (b) => createImageBitmap(new Blob([b], { type: "image/webp" })));

/** The list of maps. Undefined while it is read, null when there are no files. */
export function useMaps() {
  const [maps] = createResource(() => mapList().catch(() => null));
  return maps;
}

/** One map and its picture, as `id` changes. */
export function useMap(id: () => number) {
  const [map] = createResource(() => id() || false, (n) => worldMap(n).catch(() => null));
  const [picture] = createResource(() => id() || false, (n) => pictureOf(`map_${n}`).catch(() => null));
  return { map, picture };
}

/** Where you are, carried on between two places said, and how old that is. */
export function useYou() {
  const pair = createMemo<{ before: Position | null; last: Position | null }>(
    (was) => {
      const now = place();
      return { before: now && was.last?.map === now.map ? was.last : null, last: now };
    },
    { before: null, last: null },
  );
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 250);
  onCleanup(() => clearInterval(timer));
  return () => {
    const { before, last } = pair();
    if (!last) return null;
    return { map: last.map, known: last.known, ...guess(before, last, now()), age: Math.max(0, now() - last.at) };
  };
}

export type You = NonNullable<ReturnType<ReturnType<typeof useYou>>>;
