import { actions } from "./actions/feature";
import { alerts } from "./alerts/feature";
import { auras } from "./auras/feature";
import { boss } from "./boss/feature";
import { bosses } from "./bosses/feature";
import { buffs, control, debuffs, partyDebuffs, ready } from "./effects/feature";
import { finish } from "./finish/feature";
import { flight } from "./flight/feature";
import { foe, force, party, target, you } from "./frames/feature";
import { history } from "./history/feature";
import { map, tracker } from "./map/feature";
import { meter } from "./meter/feature";
import { pets } from "./pets/feature";
import { ping } from "./ping/feature";
import { pvp } from "./pvp/feature";
import { splits } from "./splits/feature";
import { resources } from "./resources/feature";
import { timers } from "./timers/feature";
import { training } from "./training/feature";
import type { Feature } from "./types";

/** Pages stand in the menu in this order. */
export const FEATURES: Feature[] = [
  meter, boss, finish, splits, timers, training, history, bosses, resources, map, pets, auras, alerts,
  you, target, foe, party, force,
  buffs, debuffs, partyDebuffs, control, ready, actions,
  flight, ping, pvp, tracker,
];
