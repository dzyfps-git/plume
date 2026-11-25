import { boss } from "./boss/feature";
import { history } from "./history/feature";
import { meter } from "./meter/feature";
import { training } from "./training/feature";
import type { Feature } from "./types";

export const FEATURES: Feature[] = [meter, boss, training, history];
