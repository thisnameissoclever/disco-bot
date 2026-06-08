import { periodWindow, type PeriodType, type PeriodWindow } from '../util/time.js';

export type { PeriodType, PeriodWindow };

export interface PeriodConfig {
  type: PeriodType;
  rollingHours?: number;
}

export function activePeriod(now: Date, config: PeriodConfig): PeriodWindow {
  return periodWindow(now, config.type, { rollingHours: config.rollingHours ?? 24 });
}
