import { createSignal, Show, useContext, type JSX } from "solid-js";
import { query, Within } from "./search";

const [folded, setFolded] = createSignal<ReadonlySet<string>>(new Set());

/** Settings that belong together, under a name that folds them away. A search opens it. */
export function Group(props: { name: string; about?: string; children: JSX.Element }) {
  const within = useContext(Within);
  return (
    <Within.Provider value={`${within} ${props.name}`}>
      <details
        class="block group"
        data-search={query() ? "" : undefined}
        open={!!query() || !folded().has(props.name)}
        onToggle={(e) => {
          if (query()) return;
          const next = new Set(folded());
          if (e.currentTarget.open) next.delete(props.name);
          else next.add(props.name);
          setFolded(next);
        }}
      >
        <summary>
          <h2>{props.name}</h2>
          <Show when={props.about}><small class="ui-muted">{props.about}</small></Show>
        </summary>
        {props.children}
      </details>
    </Within.Provider>
  );
}
