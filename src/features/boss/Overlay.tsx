import { BossBar } from "./Bar";
import "../meter/meter.css";

export const BossOverlay = () => (
  <section class="boss-alone glass" aria-label="Boss health"><BossBar /></section>
);
