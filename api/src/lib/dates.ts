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

/** Whole weeks (1-based) elapsed in a cycle as of `today`, clamped to [0, durationWeeks]. */
export function currentCycleWeek(startDate: string, durationWeeks: number, today: string): number {
  if (today < startDate) return 0;
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.min(durationWeeks, Math.floor(ms / (7 * 86400000)) + 1);
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
