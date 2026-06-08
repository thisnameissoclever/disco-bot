export type PeriodType = 'day' | 'week' | 'month' | 'rolling_n_hours';

export interface PeriodWindow {
  start: Date;
  end: Date;
  label: string;
}

export function periodWindow(
  now: Date,
  type: PeriodType,
  options: { rollingHours?: number } = {},
): PeriodWindow {
  switch (type) {
    case 'day': {
      const start = startOfUtcDay(now);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return { start, end, label: 'today' };
    }
    case 'week': {
      const start = startOfUtcWeek(now);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { start, end, label: 'this week' };
    }
    case 'month': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return { start, end, label: 'this month' };
    }
    case 'rolling_n_hours': {
      const hours = options.rollingHours ?? 24;
      const end = new Date(now);
      const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
      return { start, end, label: `the last ${hours}h` };
    }
  }
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Treats Monday as the first day of the week (ISO).
export function startOfUtcWeek(d: Date): Date {
  const day = d.getUTCDay();
  const isoDow = day === 0 ? 7 : day;
  const startOfDay = startOfUtcDay(d);
  return new Date(startOfDay.getTime() - (isoDow - 1) * 24 * 60 * 60 * 1000);
}

export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function hoursAgo(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export function isWithinHours(when: Date, now: Date, hours: number): boolean {
  return now.getTime() - when.getTime() <= hours * 60 * 60 * 1000;
}
