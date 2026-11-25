import type { Component } from "solid-js";
import type { Place } from "../store/settings";

/** A part of the app. To add one: a folder, and a line in `index.ts`. */
export interface Feature {
  id: string;
  name: string;
  /** A Segoe Fluent Icons character. */
  icon: string;
  /** The icon's colour in the menu. */
  color?: string;
  page?: Component;
  overlay?: Overlay;
  /** Overlays that come and go, each with a place of its own. The same one is the same object each time. */
  more?: () => Feature[];
}

export const GROUPS = ["Fight", "Health", "Effects", "Other"] as const;

export interface Overlay {
  view: Component;
  /** When it is not the feature's own. */
  name?: string;
  group: (typeof GROUPS)[number];
  /** One line for the overlay list. */
  about: string;
  /** In CSS pixels at scale 1. The height follows the content. */
  width: number;
  place: Place;
  /** Nothing to show right now, so it hides unless it is being placed. */
  empty?: () => boolean;
  /** The edge that stays where it is as the height changes. Without one, it grows both ways. */
  edge?: () => "top" | "bottom";
  /** Runs once beside the overlays, shown or not. */
  beside?: () => void;
}

export const overlayName = (f: Feature) => f.overlay?.name ?? f.name;
