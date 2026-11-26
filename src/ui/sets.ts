/** One more or one fewer in a set of choices, as a new set. */
export function flip<T>(set: ReadonlySet<T>, one: T): ReadonlySet<T> {
  const next = new Set(set);
  if (!next.delete(one)) next.add(one);
  return next;
}
