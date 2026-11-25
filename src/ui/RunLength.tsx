import { change, settings } from "../store";
import { RUNS } from "../store/settings";
import { Choices } from "./Line";

const length = (s: number) => (s === 0 ? "No limit" : s < 60 ? `${s} s` : `${s / 60} min`);

/** How long a training run is. */
export const RunLength = (props: { after?: () => void }) => (
  <Choices
    name="Length of a training run"
    all={RUNS.map((s) => [s as number, length(s)] as const)}
    value={settings.training.seconds}
    set={(n) => {
      change((s) => (s.training.seconds = n));
      props.after?.();
    }}
  />
);
