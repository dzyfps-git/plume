import { onMount } from "solid-js";
import { appWindow } from "../api";
import { change, keepNow, settings } from "../store";
import { NAME } from "./brand";
import { Styles } from "./Look";
import { useSample } from "./Preview";

/** The first start: a page of its own, so the window still moves. One choice, the meter's look; the rest starts as most like it. */
export function FirstStart() {
  useSample();
  const done = () => change((s) => (s.started = true));
  const key = () => settings.hotkeys.quick || "the button over the game";
  return (
    <section class="first" aria-label={`${NAME}, first start`}>
      <header>
        <h1>Welcome to {NAME}</h1>
        <p>Pick how your meter looks. Everything else starts as most people like it, and all of it can be changed later.</p>
      </header>
      <Styles />
      <div class="first-tips">
        <div>
          <span class="ui-icon" aria-hidden="true">{""}</span>
          <p><b>{key()}</b> over the game opens the overlay controls: turn overlays on and off, and drag any of them anywhere.</p>
        </div>
        <div>
          <span class="ui-icon" aria-hidden="true">{""}</span>
          <p>While the mouse pointer shows, each overlay has a handle on its top edge. Drag it to move the overlay, or right-click it for its menu.</p>
        </div>
        <div>
          <span class="ui-icon" aria-hidden="true">{""}</span>
          <p>The first time you close this window, {NAME} asks whether it keeps running in the tray or quits.</p>
        </div>
      </div>
      <footer>
        <button class="ui-button" data-main onClick={done}>Start</button>
      </footer>
    </section>
  );
}

/** Asked once, the first time the main window closes: does Plume keep running in the tray, with the overlays, or quit. */
export function CloseAsk(props: { close: () => void }) {
  let dialog!: HTMLDialogElement;
  onMount(() => dialog.showModal());
  const choose = async (close: "tray" | "quit") => {
    change((s) => {
      s.close = close;
      s.closeAsked = true;
    });
    await keepNow();
    props.close();
    await appWindow().close();
  };
  return (
    <dialog ref={dialog} class="ui-sheet close-ask" aria-label={`Closing ${NAME}`} onClose={props.close}>
      <h2>Closing {NAME}</h2>
      <p>In the tray, {NAME} keeps your overlays over the game and reads your fights. Quitting stops all of it.</p>
      <p class="ui-muted">Asked once. Settings, Windows changes it later.</p>
      <div class="ui-sheet-buttons">
        <button class="ui-button" onClick={() => void choose("quit")}>Quit {NAME}</button>
        <button class="ui-button" data-main onClick={() => void choose("tray")}>Keep it in the tray</button>
      </div>
    </dialog>
  );
}
