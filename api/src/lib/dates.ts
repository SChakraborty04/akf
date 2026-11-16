import { unprocessable } from './errors';

/** 'YYYY-MM-DD' for "now" in the given IANA timezone (default India). */
export function todayInTimezone(timeZone = 'Asia/Kolkata', now = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** YYYY-MM-DD + n days (UTC arithmetic, no DST concerns). */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole-day difference (targetYMD - baseYMD) in UTC calendar days. */
export function diffDaysYMD(targetYMD: string, baseYMD: string): number {
  const [ty, tm, td] = targetYMD.split('-').map(Number);
  const [by, bm, bd] = baseYMD.split('-').map(Number);
  const tUtc = Date.UTC(ty, tm - 1, td);
  const bUtc = Date.UTC(by, bm - 1, bd);
  return Math.round((tUtc - bUtc) / 86400000);
}

/** Returns the Monday ('YYYY-MM-DD') of the calendar week containing `ymd`. */
export function getMondayOfWeekYMD(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (dow + 6) % 7;
  return addDays(ymd, -diffToMonday);
}

/**
 * Returns the first Monday ('YYYY-MM-DD') on or after `ymd`.
 * E.g., if cycleStart is Thu 2026-01-01, Week 1 starts Mon 2026-01-05.
 */
export function getFirstMondayOnOrAfterYMD(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const offset = (1 - dow + 7) % 7;
  return addDays(ymd, offset);
}

export type CycleWeekInfo = {
  weekKey: string;
  weekNumber: number | null;
  isPreCycle: boolean;
  weekStartYMD: string;
  weekEndYMD: string;
};

/**
 * Computes Monday-aligned cycle week number & date range (Mon–Sun) for `ymd`.
 * Dates before Week 1 Monday are marked `isPreCycle: true` (never negative week numbers).
 */
export function getCycleWeekInfo(
  ymd: string,
  cycleStart?: string | null,
  fallbackDates: string[] = [],
): CycleWeekInfo {
  const isValidYmd = (s?: string | null): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

  let week1Monday: string;
  if (isValidYmd(cycleStart)) {
    week1Monday = getFirstMondayOnOrAfterYMD(cycleStart);
  } else {
    const valid = fallbackDates.filter(isValidYmd).sort();
    week1Monday = valid.length > 0 ? getMondayOfWeekYMD(valid[0]) : getMondayOfWeekYMD(ymd);
  }

  const safeYmd = isValidYmd(ymd) ? ymd : week1Monday;
  const weekStartYMD = getMondayOfWeekYMD(safeYmd);
  const weekEndYMD = addDays(weekStartYMD, 6);
  const diff = diffDaysYMD(weekStartYMD, week1Monday);

  if (diff < 0) {
    return {
      weekKey: weekStartYMD,
      weekNumber: null,
      isPreCycle: true,
      weekStartYMD,
      weekEndYMD,
    };
  }

  return {
    weekKey: weekStartYMD,
    weekNumber: Math.floor(diff / 7) + 1,
    isPreCycle: false,
    weekStartYMD,
    weekEndYMD,
  };
}

/** Whole weeks (1-based, Monday-aligned) elapsed in a cycle as of `today`, clamped to [0, durationWeeks]. */
export function currentCycleWeek(startDate: string, durationWeeks: number, today: string): number {
  const info = getCycleWeekInfo(today, startDate);
  if (info.isPreCycle || info.weekNumber === null) return 0;
  return Math.min(durationWeeks, info.weekNumber);
}

/**
 * Transactions may be back-dated (the PWA lets the operator pick any date, and
 * offline entries sync later) but not meaningfully future-dated. One day of
 * slack covers device clocks that are ahead of the server timezone.
 */
export function assertDateAllowed(date: string, today: string): void {
  if (date > addDays(today, 1)) {
    throw unprocessable('Date cannot be in the future', 'FUTURE_DATE', { date, today });
  }
}
