/**
 * Date helpers for SHG meeting-day constraints and local YYYY-MM-DD formatting.
 */

const WEEKDAY_MAP = {
  sunday: 0,
  sun: 0,
  sundays: 0,
  रविवार: 0,
  monday: 1,
  mon: 1,
  mondays: 1,
  सोमवार: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  tuesdays: 2,
  मंगलवार: 2,
  wednesday: 3,
  wed: 3,
  wednesdays: 3,
  बुधवार: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursdays: 4,
  गुरुवार: 4,
  बृहस्पतिवार: 4,
  friday: 5,
  fri: 5,
  fridays: 5,
  शुक्रवार: 5,
  saturday: 6,
  sat: 6,
  saturdays: 6,
  शनिवार: 6,
};

export const WEEKDAY_NAMES_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const WEEKDAY_NAMES_HI = [
  'रविवार',
  'सोमवार',
  'मंगलवार',
  'बुधवार',
  'गुरुवार',
  'शुक्रवार',
  'शनिवार',
];

/**
 * Returns local calendar date as 'YYYY-MM-DD'.
 */
export function getLocalTodayYMD(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatLocalYMD(year, monthIndex0, day) {
  const m = String(monthIndex0 + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Parses 'YYYY-MM-DD' into a local Date (midnight local time), or null if invalid.
 */
export function parseYMD(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

/**
 * Maps groupProfile.meetingDay (e.g. 'Monday', 'Friday') to JS weekday index 0..6,
 * or null when not constrained to a specific weekday (e.g. 'Weekly').
 */
export function parseMeetingWeekday(meetingDay) {
  if (!meetingDay || typeof meetingDay !== 'string') return null;
  const normalized = meetingDay.trim().toLowerCase();
  if (normalized in WEEKDAY_MAP) {
    return WEEKDAY_MAP[normalized];
  }
  return null;
}

/**
 * Returns localized weekday label for a meeting day string, or null if flexible.
 */
export function getMeetingDayLabel(meetingDay, language = 'en') {
  const idx = parseMeetingWeekday(meetingDay);
  if (idx === null) return null;
  return language === 'hi' ? WEEKDAY_NAMES_HI[idx] : WEEKDAY_NAMES_EN[idx];
}

/**
 * Validates whether `ymd` is allowed for recording a transaction:
 * 1. Must be a valid 'YYYY-MM-DD' date
 * 2. Must not be in the future (ymd <= todayYMD)
 * 3. If SHG has a specific meetingDay weekday, must fall on that weekday
 */
export function isDateAllowedForMeeting(ymd, meetingDay, todayYMD = getLocalTodayYMD()) {
  const dt = parseYMD(ymd);
  if (!dt) return { allowed: false, reason: 'invalid' };
  if (ymd > todayYMD) return { allowed: false, reason: 'future' };

  const targetWeekday = parseMeetingWeekday(meetingDay);
  if (targetWeekday !== null && dt.getDay() !== targetWeekday) {
    return { allowed: false, reason: 'notMeetingDay', targetWeekday };
  }

  return { allowed: true };
}

/**
 * Returns the most recent allowed meeting date <= todayYMD.
 */
export function getLatestAllowedMeetingDate(meetingDay, todayYMD = getLocalTodayYMD()) {
  const todayDt = parseYMD(todayYMD) || new Date();
  const targetWeekday = parseMeetingWeekday(meetingDay);

  if (targetWeekday === null) {
    return getLocalTodayYMD(todayDt);
  }

  const diff = (todayDt.getDay() - targetWeekday + 7) % 7;
  const latest = new Date(todayDt.getFullYear(), todayDt.getMonth(), todayDt.getDate() - diff);
  return getLocalTodayYMD(latest);
}

/**
 * Adds `days` to a 'YYYY-MM-DD' string using UTC calendar arithmetic.
 */
export function addDaysYMD(ymd, days) {
  const dt = parseYMD(ymd);
  if (!dt) return ymd;
  const utc = Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate() + days);
  return new Date(utc).toISOString().slice(0, 10);
}

/**
 * Whole-day difference (targetYMD - baseYMD).
 */
export function diffDaysYMD(targetYMD, baseYMD) {
  const t = parseYMD(targetYMD);
  const b = parseYMD(baseYMD);
  if (!t || !b) return 0;
  const tUtc = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((tUtc - bUtc) / 86400000);
}

/**
 * Returns the Monday ('YYYY-MM-DD') of the week containing `ymd`.
 */
export function getMondayOfWeekYMD(ymd) {
  const dt = parseYMD(ymd) || new Date();
  const diffToMon = (dt.getDay() + 6) % 7;
  return addDaysYMD(getLocalTodayYMD(dt), -diffToMon);
}

/**
 * Resolves the Week-1 start anchor date: prefers group cycleStart,
 * otherwise Monday of the earliest provided record date (or today's Monday).
 */
export function resolveCycleAnchorDate(cycleStart, fallbackDates = []) {
  if (parseYMD(cycleStart)) {
    return cycleStart;
  }
  const validDates = fallbackDates.filter((d) => Boolean(parseYMD(d))).sort();
  if (validDates.length > 0) {
    return getMondayOfWeekYMD(validDates[0]);
  }
  return getMondayOfWeekYMD(getLocalTodayYMD());
}

/**
 * Computes cycle week number and date range for a given 'YYYY-MM-DD' date.
 */
export function getWeekInfoForDate(ymd, cycleStart, fallbackDates = []) {
  const anchor = resolveCycleAnchorDate(cycleStart, fallbackDates);
  const safeYmd = parseYMD(ymd) ? ymd : anchor;
  const diff = diffDaysYMD(safeYmd, anchor);
  const zeroBasedWeek = Math.floor(diff / 7);
  const weekNumber = zeroBasedWeek >= 0 ? zeroBasedWeek + 1 : zeroBasedWeek;
  const weekStartYMD = addDaysYMD(anchor, zeroBasedWeek * 7);
  const weekEndYMD = addDaysYMD(weekStartYMD, 6);

  return {
    weekKey: weekStartYMD,
    weekNumber,
    weekStartYMD,
    weekEndYMD,
  };
}

/**
 * Formats a compact readable date range for a week, e.g. "5–11 Jan 2026" or "26 Jan – 1 Feb 2026".
 */
export function formatWeekDateRange(startYMD, endYMD, locale = 'en') {
  const s = parseYMD(startYMD);
  const e = parseYMD(endYMD);
  if (!s || !e) return startYMD || '';

  const loc = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();

  if (sameMonth) {
    const monthYear = e.toLocaleDateString(loc, { month: 'short', year: 'numeric' });
    return `${s.getDate()}–${e.getDate()} ${monthYear}`;
  }
  if (sameYear) {
    const sPart = s.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
    const ePart = e.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${sPart} – ${ePart}`;
  }
  const sPart = s.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
  const ePart = e.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${sPart} – ${ePart}`;
}

/**
 * Formats a short single date for compact chart axis labels, e.g. "5 Jan".
 */
export function formatShortDayMonth(ymd, locale = 'en') {
  const dt = parseYMD(ymd);
  if (!dt) return ymd || '';
  return dt.toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Groups financial records into cycle weeks with date ranges and totals.
 */
export function groupItemsByWeek(
  items = [],
  { cycleStart, fallbackDates = [], getDate = (i) => i.date, getAmount = (i) => Number(i.amount || 0) } = {}
) {
  const allDates = [
    ...fallbackDates,
    ...items.map((item) => getDate(item)).filter(Boolean),
  ];

  const weekMap = new Map();

  for (const item of items) {
    const itemDate = getDate(item);
    const info = getWeekInfoForDate(itemDate, cycleStart, allDates);
    let bucket = weekMap.get(info.weekKey);
    if (!bucket) {
      bucket = {
        ...info,
        items: [],
        totalAmount: 0,
        count: 0,
      };
      weekMap.set(info.weekKey, bucket);
    }
    bucket.items.push(item);
    bucket.totalAmount += Number(getAmount(item) || 0);
    bucket.count += 1;
  }

  const chartWeeks = Array.from(weekMap.values()).sort((a, b) =>
    a.weekStartYMD.localeCompare(b.weekStartYMD)
  );
  const listWeeks = [...chartWeeks].reverse();

  return { chartWeeks, listWeeks };
}

