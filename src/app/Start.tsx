import { createSignal, For, onMount, Show } from "solid-js";
import { FEATURES } from "../features";
import { meter } from "../features/meter/feature";
import { overlayName } from "../features/types";
import { change, settings } from "../store";
import { place } from "../store/settings";
import { Choices, Line } from "../ui/Line";
import { NAME } from "./brand";
import { Styles } from "./Look";
import { useSample } from "./Preview";

const STEPS = ["Choose a look", "Choose a place", "Choose what shows"];
const CORNERS = [["Top left", 0, 0], ["Top right", 1, 0], ["Bottom left", 0, 1], ["Bottom right", 1, 1]] as const;
/** Overlays most people want to know of. The others are on the Overlays page. */
const FIRST = ["boss", "party", "buffs", "actions", "control", "alerts", "resources", "flight"];

/** The first start: how the meter looks, where it is, and what else shows. All of it can be changed later. */
export function FirstStart() {
  useSample();
  let dialog!: HTMLDialogElement;
  const [step, setStep] = createSignal(0);
  onMount(() => dialog.showModal());
  const done = () => change((s) => (s.started = true));
  const at = (id: string) => {
    const f = FEATURES.find((x) => x.id === id)!;
    return place(settings.places[id], f.overlay!.place);
  };
  const corner = () => `${at(meter.id).x} ${at(meter.id).y}`;
  return (
    <dialog ref={dialog} class="ui-sheet first" aria-label={`${NAME}, first start`} onClose={done}>
      <small class="ui-muted">{step() + 1} of {STEPS.length}</small>
      <h2>{STEPS[step()]}</h2>
      <Show when={step() === 0}><Styles /></Show>
      <Show when={step() === 1}>
        <div class="corners" role="radiogroup" aria-label="Corner of the screen">
          <For each={CORNERS}>
            {([name, x, y]) => (
              <button
                role="radio" class="corner" aria-label={name} aria-checked={corner() === `${x} ${y}`} style={{ "justify-self": x ? "end" : "start", "align-self": y ? "end" : "start" }}
                onClick={() => change((s) => {
                  s.places = { ...s.places, [meter.id]: { ...at(meter.id), x, y } };
                  s.meter.edge = y ? "bottom" : "top";
                })}
              />
            )}
          </For>
        </div>
        <Line name="Size">
          <Choices name="Size" all={[[0.8, "Small"], [1, "Normal"], [1.2, "Large"]] as const} value={at(meter.id).scale} set={(scale) => change((s) => (s.places = { ...s.places, [meter.id]: { ...at(meter.id), scale } }))} />
        </Line>
      </Show>
      <Show when={step() === 2}>
        <div class="ui-row" role="group" aria-label="Overlays">
          <For each={FEATURES.filter((f) => FIRST.includes(f.id))}>
            {(f) => (
              <button class="ui-chip" aria-pressed={at(f.id).on} onClick={() => change((s) => (s.places = { ...s.places, [f.id]: { ...at(f.id), on: !at(f.id).on } }))}>
                <span class="ui-icon" aria-hidden="true">{f.icon}</span>
                {overlayName(f)}
              </button>
            )}
          </For>
        </div>
        <p>The meter shows already. All of this can be changed later under Meter look and Overlays.</p>
      </Show>
      <div class="ui-sheet-buttons">
        <Show when={step() > 0} fallback={<button class="ui-button" onClick={done}>Skip</button>}>
          <button class="ui-button" onClick={() => setStep(step() - 1)}>Back</button>
        </Show>
        <button class="ui-button" data-main onClick={() => (step() < STEPS.length - 1 ? setStep(step() + 1) : done())}>{step() < STEPS.length - 1 ? "Next" : "Done"}</button>
      </div>
    </dialog>
  );
}
