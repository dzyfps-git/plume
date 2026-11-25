// One search over every setting: what does not match is left out of the page.
import { createContext, createSignal, useContext } from "solid-js";

const [typed, setQuery] = createSignal("");
const query = () => typed().trim();
export { query, setQuery };

/** Names of the groups a setting stands in. They match as its own name does. */
export const Within = createContext("");

/** Every word has to be there, in any order. */
export function matches(text: string, words: string) {
  const all = text.toLowerCase();
  return words.toLowerCase().split(/\s+/).every((w) => all.includes(w));
}

/** Whether a setting is left out by the search. Called as its component is made. */
export function useMissed(of: () => string): () => true | undefined {
  const within = useContext(Within);
  return () => (query() && !matches(`${within} ${of()}`, query()) ? true : undefined);
}
