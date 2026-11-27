import { createEffect, createSignal, onCleanup, onMount, Show, untrack } from "solid-js";
import { picture } from "../../api";
import { settings } from "../../store";
import type { Layer } from "../../store/settings";
import type { You } from "./data";
import { DENSE, FINDABLE, isFound, keyOf, LAYER_COLOURS, LAYER_NAMES, markOf, unpack, type Spot, type Thing, type WorldMap } from "./logic";

export interface Picked {
  thing: Thing;
  spot: Spot;
}

export interface MapProps {
  map: WorldMap;
  picture?: ImageBitmap | null;
  layers: readonly Layer[];
  found: Record<string, number[]>;
  hideFound: boolean;
  /** Keys of "map/thing", drawn larger, whatever their layer. */
  tracked: ReadonlySet<string>;
  you?: You | null;
  /** Packed spots of a route, in order. */
  route?: readonly number[];
  picked?: Picked | null;
  /** Keeps you in the middle. */
  follow: boolean;
  /** Metres across, for a small map that only follows you. */
  across?: number;
  /** Names of regions and villages. */
  labels?: boolean;
  onPick?: (picked: Picked | null, at: { x: number; y: number }) => void;
  /** Dragged or zoomed by hand. */
  onMoved?: () => void;
  /** Asked to look at a place. */
  look?: () => { x: number; y: number; across?: number } | null;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The marks' pictures, read once a window. Missing ones stay dots. */
const marks = new Map<string, ImageBitmap | null>();
const [marksRead, setMarksRead] = createSignal(0);
function markPicture(name: string | undefined) {
  if (!name || !settings.pictures) return null;
  if (!marks.has(name)) {
    marks.set(name, null);
    void picture(name)
      .then((b) => createImageBitmap(new Blob([b], { type: "image/png" })))
      .then((bitmap) => (marks.set(name, bitmap), setMarksRead((n) => n + 1)), () => {});
  }
  return marks.get(name) ?? null;
}

/** A map to pan and zoom, with its marks. Drawn on a canvas: some maps have twenty thousand. */
export function MapCanvas(props: MapProps) {
  let canvas!: HTMLCanvasElement;
  const [size, setSize] = createSignal({ width: 0, height: 0, ratio: 1 });
  /** The middle, in metres, and points of the screen per metre. 0 fits the map. */
  const [view, setView] = createSignal({ x: 0, y: 0, scale: 0 });
  /** Where each drawn mark is, to find the one under the mouse. */
  let drawn: { x: number; y: number; r: number; thing: Thing; spot: Spot }[] = [];
  /** The mark under the mouse, for its name. */
  const [over, setOver] = createSignal<{ x: number; y: number; thing: Thing } | null>(null);

  const fit = () => {
    const [left, top, right, bottom] = props.map.bounds;
    const { width, height } = size();
    return Math.min(width / (right - left), height / (bottom - top)) || 1;
  };
  /** Closest in: three times the picture's own pixels, so it never turns to mush. */
  const most = () => {
    const [left, , right] = props.map.bounds;
    return props.picture ? Math.max(fit() * 6, (props.picture.width / (right - left)) * 3) : fit() * 40;
  };
  const scale = () => (props.across ? size().width / props.across : view().scale || fit());
  const middle = () => {
    const you = props.you;
    if ((props.follow || props.across) && you?.known && you.map === props.map.id) return you;
    if (view().scale) return view();
    const [left, top, right, bottom] = props.map.bounds;
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  };
  const toScreen = (x: number, y: number) => {
    const m = middle();
    const s = scale();
    return { x: (x - m.x) * s + size().width / 2, y: (y - m.y) * s + size().height / 2 };
  };
  const toMap = (px: number, py: number) => {
    const m = middle();
    const s = scale();
    return { x: (px - size().width / 2) / s + m.x, y: (py - size().height / 2) / s + m.y };
  };

  // A new map starts whole.
  createEffect(() => {
    void props.map.id;
    setView({ x: 0, y: 0, scale: 0 });
  });
  createEffect(() => {
    const at = props.look?.();
    if (!at) return;
    untrack(() => {
      const s = at.across ? size().width / at.across : Math.max(scale(), fit() * 3);
      setView({ x: at.x, y: at.y, scale: Math.min(s, most()) });
    });
  });

  function draw() {
    const { width, height, ratio } = size();
    const pen = canvas.getContext("2d");
    if (!pen || !width) return;
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen.clearRect(0, 0, width, height);
    const m = props.map;
    const s = scale();
    const [left, top, right, bottom] = m.bounds;
    const corner = toScreen(left, top);
    if (props.picture) {
      pen.imageSmoothingQuality = "high";
      pen.drawImage(props.picture, corner.x, corner.y, (right - left) * s, (bottom - top) * s);
    }
    const font = css("--font-sans") || "sans-serif";
    // Borders of the regions, faint.
    pen.lineWidth = 1;
    pen.strokeStyle = "rgba(255, 255, 255, 0.22)";
    for (const r of m.regions) {
      pen.beginPath();
      for (let i = 0; i < r.shape.length; i += 2) {
        const p = toScreen(r.shape[i], r.shape[i + 1]);
        if (i) pen.lineTo(p.x, p.y);
        else pen.moveTo(p.x, p.y);
      }
      pen.closePath();
      pen.stroke();
    }
    const on = new Set(props.layers);
    drawn = [];
    // Small when the whole map shows, so thousands do not run together; larger as you come in.
    const dot = Math.min(5, 2.5 + (s / fit()) * 0.3);
    const close = s / fit();
    // The game's pictures: always for the few, and for the many once you come in.
    const side = Math.min(30, 18 + close * 1.5);
    for (const thing of m.things) {
      const key = keyOf(m.id, thing);
      const tracked = props.tracked.has(key);
      if (!tracked && !on.has(thing.layer)) continue;
      const findable = FINDABLE.includes(thing.layer);
      pen.fillStyle = LAYER_COLOURS[thing.layer];
      // The many stay dots until you are well in, and then come smaller, so they do not bury the map.
      const dense = DENSE.includes(thing.layer);
      const pic = dense && close < 6 ? null : markPicture(markOf(thing.layer, m.side));
      for (let i = 0; i + 4 < thing.spots.length; i += 5) {
        const p = toScreen(thing.spots[i], thing.spots[i + 1]);
        if (p.x < -10 || p.y < -10 || p.x > width + 10 || p.y > height + 10) continue;
        const spot = { x: thing.spots[i], y: thing.spots[i + 1], z: thing.spots[i + 2], region: thing.spots[i + 3], zone: thing.spots[i + 4] };
        const found = findable && isFound(props.found, key, spot);
        if (found && props.hideFound) continue;
        pen.globalAlpha = found ? 0.35 : 1;
        if (pic) {
          const size = (tracked ? 1.25 : 1) * (dense ? side * 0.7 : side);
          if (tracked) {
            pen.strokeStyle = "#ffffff";
            pen.lineWidth = 2;
            pen.beginPath();
            pen.arc(p.x, p.y, size / 2 + 2, 0, Math.PI * 2);
            pen.stroke();
          }
          pen.drawImage(pic, p.x - size / 2, p.y - size / 2, size, size);
          drawn.push({ x: p.x, y: p.y, r: size / 2, thing, spot });
          continue;
        }
        const r = tracked ? dot * 1.6 : dot;
        pen.beginPath();
        pen.arc(p.x, p.y, r, 0, Math.PI * 2);
        pen.fill();
        // A dark rim keeps a mark clear on any ground; a tracked one gets a white one.
        pen.strokeStyle = tracked ? "#ffffff" : "rgba(6, 8, 12, 0.8)";
        pen.lineWidth = tracked ? 1.5 : dot > 4 ? 1.25 : 0.75;
        pen.stroke();
        drawn.push({ x: p.x, y: p.y, r, thing, spot });
      }
    }
    pen.globalAlpha = 1;
    if (props.labels !== false && !props.across) {
      pen.textAlign = "center";
      pen.textBaseline = "middle";
      pen.lineWidth = 3;
      pen.strokeStyle = "rgba(0, 0, 0, 0.7)";
      // Regions first. A name that would lie over one already drawn is left out.
      const taken: [number, number, number, number][] = [];
      for (const l of [...m.labels].sort((a, b) => Number(a.village) - Number(b.village))) {
        if (l.village && s < fit() * 2.5) continue;
        const p = toScreen(l.x, l.y);
        pen.font = `${l.village ? 500 : 600} ${l.village ? 11 : 12}px ${font}`;
        const half = pen.measureText(l.name).width / 2 + 3;
        const box: [number, number, number, number] = [p.x - half, p.y - 8, p.x + half, p.y + 8];
        if (taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])) continue;
        taken.push(box);
        pen.fillStyle = l.village ? "#f2e6c9" : "#ffffff";
        pen.strokeText(l.name, p.x, p.y);
        pen.fillText(l.name, p.x, p.y);
      }
    }
    const accent = css("--accent") || "#8f6bff";
    if (props.route?.length) {
      pen.strokeStyle = accent;
      pen.fillStyle = accent;
      pen.lineWidth = 2.5;
      pen.beginPath();
      props.route.forEach((n, i) => {
        const { x, y } = unpack(n);
        const p = toScreen(x, y);
        if (i) pen.lineTo(p.x, p.y);
        else pen.moveTo(p.x, p.y);
      });
      pen.stroke();
      for (const n of props.route) {
        const { x, y } = unpack(n);
        const p = toScreen(x, y);
        pen.beginPath();
        pen.arc(p.x, p.y, 4, 0, Math.PI * 2);
        pen.fill();
      }
    }
    if (props.picked) {
      const p = toScreen(props.picked.spot.x, props.picked.spot.y);
      pen.strokeStyle = "#ffffff";
      pen.lineWidth = 2;
      pen.beginPath();
      pen.arc(p.x, p.y, dot * 2.6, 0, Math.PI * 2);
      pen.stroke();
    }
    const you = props.you;
    if (you?.known && you.map === m.id) {
      const p = toScreen(you.x, you.y);
      // A guess is a ring: the game has not said it.
      pen.setLineDash(you.guess ? [3, 3] : []);
      pen.strokeStyle = accent;
      pen.lineWidth = 2;
      pen.beginPath();
      pen.arc(p.x, p.y, 11, 0, Math.PI * 2);
      pen.stroke();
      pen.setLineDash([]);
      pen.fillStyle = accent;
      pen.strokeStyle = "#ffffff";
      pen.beginPath();
      pen.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      pen.fill();
      pen.stroke();
    }
  }

  let frame = 0;
  createEffect(() => {
    // Everything drawn is read here, so a change of any draws again, once a frame.
    for (const key in props.found) void props.found[key].length;
    void [props.map, props.picture, props.layers.join(), props.hideFound, props.tracked, props.you, props.route, props.picked, props.follow, props.across, size(), view(), marksRead()];
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  });

  onMount(() => {
    const watch = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      const ratio = devicePixelRatio || 1;
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
      setSize({ width: box.width, height: box.height, ratio });
    });
    watch.observe(canvas);
    onCleanup(() => {
      watch.disconnect();
      cancelAnimationFrame(frame);
    });
  });

  /** Dragging moves the map. A click that did not move picks what is under it. */
  let held: { x: number; y: number; from: { x: number; y: number }; moved: boolean } | null = null;
  const down = (e: PointerEvent) => {
    if (props.across || e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    held = { x: e.clientX, y: e.clientY, from: middle(), moved: false };
  };
  const near = (px: number, py: number) => {
    let best: (typeof drawn)[number] | null = null;
    let least = Infinity;
    for (const d of drawn) {
      const away = Math.hypot(d.x - px, d.y - py);
      if (away <= Math.max(12, d.r + 2) && away < least) [best, least] = [d, away];
    }
    return best;
  };
  const move = (e: PointerEvent) => {
    if (!held) {
      if (props.across) return;
      const box = canvas.getBoundingClientRect();
      const d = near(e.clientX - box.left, e.clientY - box.top);
      setOver(d && { x: d.x, y: d.y, thing: d.thing });
      return;
    }
    setOver(null);
    const [dx, dy] = [e.clientX - held.x, e.clientY - held.y];
    if (!held.moved && Math.hypot(dx, dy) < 4) return;
    if (!held.moved) props.onMoved?.();
    held.moved = true;
    setView({ x: held.from.x - dx / scale(), y: held.from.y - dy / scale(), scale: scale() });
  };
  const up = (e: PointerEvent) => {
    if (!held) return;
    const click = !held.moved;
    held = null;
    if (!click || !props.onPick) return;
    const box = canvas.getBoundingClientRect();
    const [px, py] = [e.clientX - box.left, e.clientY - box.top];
    const best = near(px, py);
    props.onPick(best && { thing: best.thing, spot: best.spot }, toMap(px, py));
  };
  const wheel = (e: WheelEvent) => {
    if (props.across) return;
    e.preventDefault();
    const box = canvas.getBoundingClientRect();
    const [px, py] = [e.clientX - box.left, e.clientY - box.top];
    const at = toMap(px, py);
    const s = Math.min(most(), Math.max(fit() * 0.8, scale() * 1.25 ** (-e.deltaY / 100)));
    props.onMoved?.();
    // The point under the mouse stays under it.
    setView({ x: at.x - (px - size().width / 2) / s, y: at.y - (py - size().height / 2) / s, scale: s });
  };

  return (
    <>
      <canvas
        ref={canvas}
        class="map-canvas"
        data-over={over() ? "" : undefined}
        role="img"
        aria-label={`Map of ${props.map.name}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => (held = null)}
        onPointerLeave={() => setOver(null)}
        onWheel={wheel}
      />
      <Show when={over()}>
        {(o) => (
          <div class="map-tip" data-below={o().y < 90 || undefined} data-edge={o().x < 120 ? "left" : o().x > size().width - 120 ? "right" : undefined} style={{ left: `${o().x}px`, top: `${o().y}px` }} aria-hidden="true">
            <b>{o().thing.name}</b>
            <small>
              <i class="tint-dot" style={{ "--tint": LAYER_COLOURS[o().thing.layer] }} /> {LAYER_NAMES[o().thing.layer]}
              {o().thing.level ? ` · level ${o().thing.level}` : ""}
            </small>
          </div>
        )}
      </Show>
    </>
  );
}
