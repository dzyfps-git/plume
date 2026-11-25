import { boss } from "./boss/feature";
import { bosses } from "./bosses/feature";
import { history } from "./history/feature";
import { meter } from "./meter/feature";
import { timers } from "./timers/feature";
import { training } from "./training/feature";
import type { Feature } from "./types";

export const FEATURES: Feature[] = [meter, boss, timers, training, history, bosses];
