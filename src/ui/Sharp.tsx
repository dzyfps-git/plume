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
      // Kept to its own shape, and never drawn much larger than it is: stretched further, it would be soft.
      // ponytail: a quarter past its size is still crisp; a larger source from NC is the real fix.
      const fit = Math.min(1.25, side / Math.max(image.width, image.height));
      const [w, h] = [Math.round(image.width * fit), Math.round(image.height * fit)];
      let from: CanvasImageSource = image;
      let [fw, fh] = [image.width, image.height];
      for (const step of halves(Math.max(fw, fh), Math.max(w, h))) {
        if (step === Math.max(w, h)) {
          canvas.width = canvas.height = side;
          const pen = canvas.getContext("2d")!;
          pen.imageSmoothingQuality = "high";
          pen.drawImage(from, Math.round((side - w) / 2), Math.round((side - h) / 2), w, h);
          break;
        }
        const k = step / Math.max(fw, fh);
        [fw, fh] = [Math.max(1, Math.round(fw * k)), Math.max(1, Math.round(fh * k))];
        const half = new OffscreenCanvas(fw, fh);
        const pen = half.getContext("2d")!;
        pen.imageSmoothingQuality = "high";
        pen.drawImage(from, 0, 0, fw, fh);
        from = half;
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
