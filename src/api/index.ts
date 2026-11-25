// The only place the pages talk to Rust.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Entries, Fight, Message, Near, Reads, Saved, State, Status } from "../live/types";

export { getVersion as appVersion } from "@tauri-apps/api/app";

/** What the overlay window is open for: nothing, moving its overlays, or the quick bar. */
export type Editing = "" | "move" | "quick";

export interface Start {
  settings: unknown;
  editing: Editing;
  /** The page to open on, or empty. */
  page?: string;
  engine: { status: Status; message?: string };
  state: State | null;
  reads: Reads | null;
  fight: Fight | null;
  near: Near | null;
  entries: Entries | null;
}

export const startState = () => invoke<Start>("start_state");
/** Gives back the actions whose key could not be had. */
export const saveSettings = (value: unknown) => invoke<string[]>("save_settings", { value });
export const engineSend = (command: { cmd: string } & Record<string, unknown>) => invoke<void>("engine_send", { command });
export const fights = () => invoke<Saved[]>("fights");
export const fight = (id: string) => invoke<Saved | null>("fight", { id });
/** Your part of a fight alone, as it is on the disk. */
export const keptFight = (id: string) => invoke<Saved | null>("kept_fight", { id });
/** Writes a file into Downloads and shows it. */
export const exportFile = (name: string, bytes: Uint8Array) => invoke<void>("export", { name, bytes: Array.from(bytes) });
export const deleteFight = (id: string) => invoke<void>("delete_fight", { id });
export const editOverlays = (mode: Editing) => invoke<void>("edit_overlays", { mode });
/** Opens the main window on a page. */
export const openPage = (page: string) => invoke<void>("open_page", { page });
/** Settings and fights in one file in Downloads, and back from one. Gives back how many fights came. */
export const backup = (name: string) => invoke<void>("backup", { name });
export const restore = (value: unknown) => invoke<number>("restore", { value });
export const openRecordingsFolder = () => invoke<void>("open_recordings_folder");
/** What of the overlay takes the mouse: left, top, right, bottom in points of the screen. */
export const setZones = (zones: [number, number, number, number][]) => invoke<void>("set_zones", { zones });
export const openEngineFolder = () => invoke<void>("open_engine_folder");
/** The names of your own sound files. */
export const soundFiles = () => invoke<string[]>("sound_files");
export const soundFile = (name: string) => invoke<ArrayBuffer>("sound_file", { name });
export const openSoundsFolder = () => invoke<void>("open_sounds_folder");
/** Which picture each skill and effect has. Null when there are none. */
export const pictures = () => invoke<unknown>("pictures");
export const picture = (name: string) => invoke<ArrayBuffer>("picture", { name });
export const openPicturesFolder = () => invoke<void>("open_pictures_folder");

interface Events {
  live: Message;
  engine: Start["engine"];
  settings: unknown;
  saved: { id: string };
  edit: Editing;
  /** The meter was emptied. */
  cleared: null;
  /** The key to look closer was pressed, or is still held. */
  peek: null;
  go: string;
}

export const on = <K extends keyof Events>(event: K, heard: (value: Events[K]) => void) =>
  listen<Events[K]>(event, ({ payload }) => heard(payload));

export const appWindow = getCurrentWindow;
