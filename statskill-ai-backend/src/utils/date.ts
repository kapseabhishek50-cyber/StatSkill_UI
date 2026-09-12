/** Date helpers. Streak logic works on calendar-day granularity (UTC day keys). */

export const startOfDay = (d: Date = new Date()): Date => {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
};

/** YYYY-MM-DD key for a date (UTC). */
export const dayKey = (d: Date = new Date()): string => d.toISOString().slice(0, 10);

export const addDays = (d: Date, days: number): Date => {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + days);
  return c;
};

/** Whole-day difference between two dates (b - a), ignoring time-of-day. */
export const dayDiff = (a: Date, b: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay);
};

export const monthsBetween = (a: Date, b: Date): number =>
  (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
