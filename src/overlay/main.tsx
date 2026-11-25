import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { on, startState, type Editing } from "../api";
import { follow } from "../live/store";
import { useSettings } from "../store";
import "../house/tokens.css";
import "../house/bundle.css";
import "./overlay.css";
import { Overlay } from "./Overlay";

const start = await startState();
const [editing, setEditing] = createSignal<Editing>(start.editing);
await useSettings(start.settings, true);
await follow(start);
await on("edit", setEditing);
render(() => <Overlay editing={editing} />, document.getElementById("root")!);
