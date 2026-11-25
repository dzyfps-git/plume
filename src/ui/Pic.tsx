import { createResource, createSignal, Show } from "solid-js";
import { picture, pictures } from "../api";
import { hue, initials } from "../features/effects/logic";
import { settings } from "../store";
import { dataUrl, pictureName, readPictures, type Pictured } from "./pictures";
import "./pic.css";

const [known, { refetch }] = createResource(() => pictures().then(readPictures, () => readPictures(null)));
const read = new Map<string, () => string | undefined>();

/** Looks into the folder again. */
export function readPicturesAgain() {
  read.clear();
  void refetch();
}
export const pictureCount = () => new Set([...Object.values(known()?.skills ?? {}), ...Object.values(known()?.effects ?? {})]).size;

/** Each picture is read once, when something first needs it. */
export function pictureOf(of: Pictured): string | undefined {
  const all = known();
  const name = settings.pictures && all ? pictureName(all, of) : undefined;
  if (!name) return undefined;
  let get = read.get(name);
  if (!get) {
    const [address, setAddress] = createSignal<string>();
    read.set(name, (get = address));
    // One that cannot be read stays letters.
    void picture(name).then((bytes) => setAddress(dataUrl(new Uint8Array(bytes ?? 0))), () => {});
  }
  return get();
}

/** A skill or an effect, small, beside its name. */
export function Pic(props: Pictured & { name: string; large?: boolean }) {
  return (
    <span class="pic" aria-hidden="true" data-large={props.large || undefined} style={{ "--hue": hue(props.name) }}>
      <Show when={pictureOf(props)} fallback={<b>{initials(props.name)}</b>}>
        {(address) => <img src={address()} alt="" decoding="async" />}
      </Show>
    </span>
  );
}
