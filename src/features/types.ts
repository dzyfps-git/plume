import type { Component } from "solid-js";
import type { Place } from "../store/settings";

/** A part of the app. To add one: a folder, and a line in `index.ts`. */
export interface Feature {
  id: string;
  name: string;
  /** A Segoe Fluent Icons character. */
  icon: string;
  page?: Component;
  overlay?: Overlay;
}

export interface Overlay {
  view: Component;
  /** One line for the overlay list. */
  about: string;
  /** In CSS pixels at scale 1. The height follows the content. */
  width: number;
  place: Place;
  /** Nothing to show right now, so it hides unless it is being placed. */
  empty?: () => boolean;
}
