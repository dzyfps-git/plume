import { near } from "../../live/store";
import type { Feature } from "../types";
import "../meter/meter.css";
import "../flight/flight.css";

const bad = () => near.ping > 150 || near.jitter > 40;

function PingOverlay() {
  return (
    <section class="flight glass" aria-label="Ping">
      <div class="flight-line">
        <span>{near.jitter >= 0 ? `Ping, moves by ${near.jitter}` : "Ping"}</span>
        <b class="ui-num" style={{ color: bad() ? "var(--fresh)" : undefined }}>{near.ping >= 0 ? `${near.ping} ms` : "-"}</b>
      </div>
    </section>
  );
}

export const ping: Feature = {
  id: "ping",
  name: "Ping",
  icon: "",
  overlay: {
    view: PingOverlay, group: "Other", about: "The round trip to the game's server, and how much it moves.", width: 190,
    place: { on: false, x: 1, y: 0, scale: 1 }, empty: () => near.ping < 0,
  },
};
