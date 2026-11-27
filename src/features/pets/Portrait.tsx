import { Show } from "solid-js";
import { GameIcon } from "../../ui/Pic";
import type { Kind, Pet } from "./logic";

/** The game's own picture for each kind. */
export const KIND_ICONS: Record<Kind, string> = { cogni: "site_Creature_Intellect", fera: "site_Creature_Feral", natura: "site_Creature_Nature", varian: "site_Creature_Trans", special: "site_Creature_Special" };

/** A pet's picture: its Market item's, or its face from the sheet, or its first letter. */
export function Portrait(props: { pet: Pet; icon?: string; sheet?: ImageBitmap | null; cell: number; columns: number }) {
  const paint = (canvas: HTMLCanvasElement) => {
    const face = props.pet.face ?? 0;
    const c = props.cell;
    // Before drawing: setting a size empties a canvas.
    canvas.width = canvas.height = c;
    canvas.getContext("2d")?.drawImage(props.sheet!, (face % props.columns) * c, Math.floor(face / props.columns) * c, c, c, 0, 0, c, c);
  };
  const face = () => (
    <Show when={props.pet.face !== undefined && props.sheet} fallback={<b>{props.pet.name[0]}</b>}>
      <canvas ref={paint} />
    </Show>
  );
  return (
    <span class="thing-pic" data-kind={props.pet.kind} aria-hidden="true">
      <Show when={props.icon} fallback={face()}>{(name) => <GameIcon name={name()}>{face()}</GameIcon>}</Show>
    </span>
  );
}
