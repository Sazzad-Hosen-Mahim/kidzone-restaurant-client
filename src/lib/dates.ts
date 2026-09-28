import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

/**
 * Dates.
 *
 * Two different things travel as strings from the API and must not be confused:
 *
 *  - a **business date** (`2026-09-22`), which is a calendar day in the
 *    business timezone. It is already the right day; parsing it as a local
 *    `Date` and reformatting would shift it in any timezone behind Dhaka.
 *  - an **instant** (`2026-09-22T09:15:00.000Z`), which is a moment in UTC and
 *    should be shown in the viewer's local time.
 *
 * Receipts are a third case: the API pre-renders their times in the business
 * timezone, because a receipt must read the same wherever it is reprinted.
 */

export const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses `YYYY-MM-DD` as local midnight, so it never shifts a day. */
export function parseBusinessDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayBusinessDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function addDays(businessDate: string, days: number): string {
  const date = parseBusinessDate(businessDate);
  date.setDate(date.getDate() + days);
  return format(date, 'yyyy-MM-dd');
}

/** `2026-09-22` -> `22 Sep 2026` */
export function formatBusinessDate(value: string | null | undefined, pattern = 'dd MMM yyyy'): string {
  if (!value) return '—';
  const date = BUSINESS_DATE.test(value) ? parseBusinessDate(value) : parseISO(value);
  return isValid(date) ? format(date, pattern) : value;
}

/** `2026-09-22` -> `Tue, 22 Sep` — for chart axes and day headers. */
export function formatBusinessDateShort(value: string): string {
  return formatBusinessDate(value, 'EEE, d MMM');
}

/** A trend period, which is `YYYY-MM-DD` daily or `YYYY-MM` monthly. */
export function formatPeriod(period: string, granularity: 'day' | 'month'): string {
  if (granularity === 'month') {
    const [year, month] = period.split('-').map(Number);
    return format(new Date(year, month - 1, 1), 'MMM yyyy');
  }
  return formatBusinessDate(period, 'd MMM');
}

/** An ISO instant in the viewer's local time. */
export function formatInstant(value: string | null | undefined, pattern = 'dd MMM yyyy, h:mm a'): string {
  if (!value) return '—';
  const date = parseISO(value);
  return isValid(date) ? format(date, pattern) : value;
}

/** Just the clock part of an instant: `4:35 PM`. */
export function formatTime(value: string | null | undefined): string {
  return formatInstant(value, 'h:mm a');
}

/** `3 minutes ago`, `2 days ago`. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseISO(value);
  return isValid(date) ? `${formatDistanceToNowStrict(date)} ago` : value;
}

/**
 * A duration in minutes as `1h 45m`.
 * Negative input is rendered with a leading minus, which is how the visit board
 * shows a session that has run over.
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';

  const negative = minutes < 0;
  const total = Math.abs(Math.round(minutes));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;

  const body = hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
  return negative ? `-${body}` : body;
}

/** `14` -> `2 PM`, for hour-of-day axes. */
export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Human label for a report range key. */
export const RANGE_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  last_week: 'Last week',
  this_month: 'This month',
  last_month: 'Last month',
  this_year: 'This year',
  custom: 'Custom range',
};

/** `1 Sep 2026 – 22 Sep 2026`, or a single date when the period is one day. */
export function formatDateRange(from: string, to: string): string {
  if (from === to) return formatBusinessDate(from);
  return `${formatBusinessDate(from)} – ${formatBusinessDate(to)}`;
}
