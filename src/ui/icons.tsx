import { For } from "solid-js";
import { GameIcon } from "./Pic";
import "./icons.css";

/** Drawn for this app, in flat colours: they stand in for the game's icons, and are what the game has none for. */
const DRAWN = {
  crown: [["#f5b53d", "M3 8l4.6 3.6L12 4l4.4 7.6L21 8l-1.9 10.2H4.9z"], ["#ffe7a3", "M12 4l4.4 7.6L12 14.5l-4.4-2.9z"], ["#c77a12", "M4.9 16h14.2l-.4 2.2H5.3z"]],
  gem: [["#6d8bff", "M12 1.5l7 8-7 13-7-13z"], ["#b9f1ff", "M12 1.5l-3 8 3 13-7-13z"], ["#9aaeff", "M9 9.5h10l-7-8z"]],
  coin: [["#e09a2b", "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z"], ["#ffd873", "M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z"], ["#c77a12", "M12 8.5l3.5 3.5-3.5 3.5L8.5 12z"]],
  ticket: [["#d8508f", "M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z"], ["#ffb3dc", "M3 6h10.5v12H3v-4a2 2 0 0 0 0-4z"]],
  key: [["#f5b53d", "M8 3a5 5 0 0 1 1.8 9.6L14 17l2-2 2 2-2 2 2 2-2 2-8.5-9A5 5 0 1 1 8 3zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"]],
  swords: [["#dff9ff", "M4 2l9 10-2 2L2 5V2zM20 2l-9 10 2 2 9-9V2z"], ["#4fd2d8", "M6 14l4 4-2 1-2 3-3-3 2-2zM18 14l-4 4 2 1 2 3 3-3-2-2z"]],
  wing: [["#6fd3ff", "M2 5c7-2 14 0 20 7-3-.8-5-.8-7-.3 2 .6 3.5 1.6 4.5 3.2-2.4-.5-4-.4-5.6.2 1.4.6 2.4 1.5 3 2.9C10 19.5 3.5 15 2 5z"], ["#e6f8ff", "M2 5c7-2 14 0 20 7C15 8.5 8 7.5 4.5 11 3.2 9.3 2.3 7.3 2 5z"]],
} as const;
export type DrawnName = keyof typeof DRAWN;

export function Drawn(props: { name: DrawnName }) {
  return (
    <svg class="drawn" viewBox="0 0 24 24" aria-hidden="true">
      <For each={DRAWN[props.name]}>{([fill, d]) => <path fill={fill} d={d} />}</For>
    </svg>
  );
}

/** What the game has an icon for: its picture, and what stands in for it. */
const THINGS = {
  power: ["profile_power_icon_pc", "swords"],
  odyle: ["Icon_Item_Odenergy_A_001", "gem"],
  kina: ["Icon_Currency_Coin_GoldNonbinding", "coin"],
  points: ["Icon_abysspoint", "coin"],
  shugo: ["Icon_Currency_Treasure_Key_Legend_004", "key"],
  invasion: ["Icon_Currency_Treasure_Key_Legend_006", "key"],
  nightmare: ["Icon_Ticket_Entrance_BossChallenge_001", "ticket"],
  ascension: ["Icon_Ticket_Entrance_Awaken_001", "ticket"],
  transcendence: ["Icon_Ticket_Entrance_PartyChallenge_001", "ticket"],
  conquest: ["Icon_Ticket_Entrance_Dungeon_001", "ticket"],
  exploration: ["Icon_Ticket_Entrance_Dungeon_001", "ticket"],
  fissure: ["Icon_Ticket_Entrance_DailyDungeon_001", "ticket"],
  subjugation: ["Icon_Add_Ticket_Dungeon_001", "ticket"],
  forge: ["Icon_Ticket_Entrance_Raid_001", "ticket"],
  rift: ["Icon_Item_Currency_AbyssTicekt_A_c_001", "ticket"],
} as const satisfies Record<string, readonly [string, DrawnName]>;
export type ThingName = keyof typeof THINGS;

export function Thing(props: { of: ThingName }) {
  return (
    <span class="thing" aria-hidden="true">
      <GameIcon name={THINGS[props.of][0]}><Drawn name={THINGS[props.of][1]} /></GameIcon>
    </span>
  );
}

/** How good a round trip is, as bars: four when it is good, one when it is bad. */
export const bars = (ping: number) => (ping < 60 ? 4 : ping < 110 ? 3 : ping < 180 ? 2 : 1);

export function PingBars(props: { ping: number }) {
  return (
    <svg class="drawn ping-bars" data-bars={bars(props.ping)} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="15" width="4" height="7" rx="1" />
      <rect x="7.6" y="11" width="4" height="11" rx="1" />
      <rect x="13.2" y="6.5" width="4" height="15.5" rx="1" />
      <rect x="18.8" y="2" width="4" height="20" rx="1" />
    </svg>
  );
}
