import { createResource, createSignal, Show, type JSX } from "solid-js";
import { picture, pictures } from "../api";
import { hue, initials } from "../features/effects/logic";
import { settings } from "../store";
import { pictureName, readPictures, type Pictured } from "./pictures";
import { Sharp } from "./Sharp";
import "./pic.css";

const [known, { refetch }] = createResource(() => pictures().then(readPictures, () => readPictures(null)));
const read = new Map<string, () => Blob | undefined>();

/** Looks into the folder again. */
export function readPicturesAgain() {
  read.clear();
  void refetch();
}
export const pictureCount = () => new Set([...Object.values(known()?.skills ?? {}), ...Object.values(known()?.effects ?? {})]).size;

/** Each picture is read once, when something first needs it. */
function pictureNamed(name: string): Blob | undefined {
  let get = read.get(name);
  if (!get) {
    const [bytes, setBytes] = createSignal<Blob>();
    read.set(name, (get = bytes));
    // One that cannot be read stays what stands in for it.
    void picture(name).then((b) => b.byteLength && setBytes(new Blob([b], { type: "image/png" })), () => {});
  }
  return get();
}

export function pictureOf(of: Pictured): Blob | undefined {
  const all = known();
  const name = settings.pictures && all ? pictureName(all, of) : undefined;
  return name ? pictureNamed(name) : undefined;
}

/** One of the game's own icons. What is inside stands in for it. */
export function GameIcon(props: { name: string; children: JSX.Element }) {
  // Looking again begins with the list.
  const picture = () => (settings.pictures && known() ? pictureNamed(props.name) : undefined);
  return <Show when={picture()} fallback={props.children}>{(bytes) => <Sharp of={bytes()} />}</Show>;
}

/** A skill or an effect, small, beside its name. */
export function Pic(props: Pictured & { name: string; large?: boolean }) {
  return (
    <span class="pic" aria-hidden="true" data-large={props.large || undefined} style={{ "--hue": hue(props.name) }}>
      <Show when={pictureOf(props)} fallback={<b>{initials(props.name)}</b>}>{(bytes) => <Sharp of={bytes()} />}</Show>
    </span>
  );
}
