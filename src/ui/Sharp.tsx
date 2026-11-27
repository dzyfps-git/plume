import { createEffect, onCleanup, onMount } from "solid-js";
import { halves } from "./pictures";

/** A picture, drawn once at the exact size it has on the screen. Scaled by the browser, a small one would be soft. */
export function Sharp(props: { of: Blob }) {
  let canvas!: HTMLCanvasElement;
  let side = 0;
  let turn = 0;

  async function draw(of: Blob) {
    const mine = ++turn;
    if (!side) return;
    const image = await createImageBitmap(of);
    // A newer picture or size may have come while this one was read.
    if (mine === turn) {
      let from: CanvasImageSource = image;
      for (const step of halves(image.width, side)) {
        const to = step === side ? canvas : new OffscreenCanvas(step, step);
        to.width = to.height = step;
        const pen = to.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        pen.imageSmoothingQuality = "high";
        pen.drawImage(from, 0, 0, step, step);
        from = to;
      }
    }
    image.close();
  }

  onMount(() => {
    const watch = new ResizeObserver(([entry]) => {
      const now = entry.devicePixelContentBoxSize[0].inlineSize;
      if (now === side) return;
      side = now;
      // One that cannot be read stays empty.
      void draw(props.of).catch(() => {});
    });
    watch.observe(canvas, { box: "device-pixel-content-box" });
    onCleanup(() => {
      turn++;
      watch.disconnect();
    });
  });
  createEffect(() => void draw(props.of).catch(() => {}));

  return <canvas ref={canvas} class="sharp" width="0" height="0" aria-hidden="true" />;
}
