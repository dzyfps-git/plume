// Where an overlay sits. Places are shares of the free space, so they hold on any screen size.

export interface Box {
  width: number;
  height: number;
}
export interface Spot {
  x: number;
  y: number;
}

const GRID = 8;
/** Space kept from the screen's edges. */
export const MARGIN = 12;
/** How near an edge or the middle pulls. */
const PULL = 10;

const free = (screen: number, own: number) => Math.max(0, screen - own - 2 * MARGIN);

export const toPixels = (at: Spot, own: Box, screen: Box): Spot => ({
  x: Math.round(MARGIN + at.x * free(screen.width, own.width)),
  y: Math.round(MARGIN + at.y * free(screen.height, own.height)),
});

/** The same place, for an overlay whose height is no longer `height`, with one edge held. */
export function hold(at: Spot, own: Box, screen: Box, edge: "top" | "bottom", height: number): Spot {
  const put = toPixels(at, { width: own.width, height }, screen);
  const y = edge === "top" ? put.y : put.y + height - own.height;
  return { x: put.x, y: Math.max(MARGIN, Math.min(y, screen.height - MARGIN - own.height)) };
}

export const toShare = (at: Spot, own: Box, screen: Box): Spot => {
  const share = (v: number, space: number) => (space > 0 ? Math.min(1, Math.max(0, (v - MARGIN) / space)) : 0);
  return { x: share(at.x, free(screen.width, own.width)), y: share(at.y, free(screen.height, own.height)) };
};

/** Pulls to the screen's edges and middle, to the other overlays' edges, or else to the grid. */
export function snap(at: Spot, own: Box, screen: Box, others: readonly (Spot & Box)[]): Spot {
  const axis = (v: number, size: number, full: number, marks: [number, number][]) => {
    const pulls = [MARGIN, full - MARGIN - size, (full - size) / 2];
    for (const [start, length] of marks) {
      pulls.push(start, start + length - size, start + length + 4, start - size - 4);
    }
    const near = pulls.filter((p) => Math.abs(p - v) <= PULL).sort((a, b) => Math.abs(a - v) - Math.abs(b - v));
    const spot = near[0] ?? Math.round(v / GRID) * GRID;
    return Math.round(Math.min(Math.max(MARGIN, full - MARGIN - size), Math.max(MARGIN, spot)));
  };
  return {
    x: axis(at.x, own.width, screen.width, others.map((o) => [o.x, o.width])),
    y: axis(at.y, own.height, screen.height, others.map((o) => [o.y, o.height])),
  };
}

/** Overlays' places as one line of text to give to someone, and back. What it holds is read like any settings. */
export const toCode = (places: Record<string, unknown>) => `plume:${btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(places))))}`;
export function fromCode(code: string): Record<string, never> | undefined {
  try {
    const v = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.trim().replace(/^plume:/, "")), (c) => c.charCodeAt(0)))) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, never>) : undefined;
  } catch {
    return undefined;
  }
}
