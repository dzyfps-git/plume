// The only place the pages talk to Rust.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Fight, Message, Saved, State, Status } from "../live/types";

export { getVersion as appVersion } from "@tauri-apps/api/app";

export interface Start {
  settings: unknown;
  editing: boolean;
  engine: { status: Status; message?: string };
  state: State | null;
  fight: Fight | null;
}

export const startState = () => invoke<Start>("start_state");
/** Gives back the actions whose key could not be had. */
export const saveSettings = (value: unknown) => invoke<string[]>("save_settings", { value });
export const engineSend = (command: { cmd: string } & Record<string, unknown>) => invoke<void>("engine_send", { command });
export const fights = () => invoke<Saved[]>("fights");
export const fight = (id: string) => invoke<Saved | null>("fight", { id });
export const deleteFight = (id: string) => invoke<void>("delete_fight", { id });
export const editOverlays = (on: boolean) => invoke<void>("edit_overlays", { on });
export const openEngineFolder = () => invoke<void>("open_engine_folder");

interface Events {
  live: Message;
  engine: Start["engine"];
  settings: unknown;
  saved: { id: string };
  edit: boolean;
}

export const on = <K extends keyof Events>(event: K, heard: (value: Events[K]) => void) =>
  listen<Events[K]>(event, ({ payload }) => heard(payload));

export const appWindow = getCurrentWindow;
