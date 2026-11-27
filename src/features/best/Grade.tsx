import { Show } from "solid-js";
import { settings } from "../../store";
import type { Grade as Graded } from "./logic";
import "./best.css";

/** How a fight was against your others, as a number in a colour. */
export function Grade(props: { of?: Graded; large?: boolean }) {
  return (
    <Show when={settings.against.grade && props.of}>
      {(g) => (
        <span class="grade ui-num" data-grade={g().tone} data-large={props.large || undefined} aria-label={`Grade ${g().score} of 100`} data-tip={g().score === 100 ? `Your best of ${g().of + 1}` : `Better than ${g().score}% of your ${g().of} others`}>
          {g().score}
        </span>
      )}
    </Show>
  );
}
