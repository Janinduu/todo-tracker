// Period dates are stored as Postgres DATE, which Prisma hands back as a
// Date pinned to UTC midnight. Every read/write here goes through UTC getters
// so a local timezone (e.g. UTC+5:30) can never shift a date by a day.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-08-21" -> Date at UTC midnight. */
export function parseDateInput(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Expected YYYY-MM-DD, got "${value}"`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${value}"`);
  }
  return date;
}

/** Date -> "2026-08-21", for <input type="date"> values. */
export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Date -> "Aug 21". */
export function formatDay(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Date -> "Aug 21, 2026". */
export function formatFull(date: Date): string {
  return `${formatDay(date)}, ${date.getUTCFullYear()}`;
}

/** "Aug 12 → Aug 18", adding years only when the range crosses one. */
export function formatRange(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return sameYear
    ? `${formatDay(start)} → ${formatDay(end)}`
    : `${formatFull(start)} → ${formatFull(end)}`;
}

/** "2026-08" -> { start: Aug 1, end: Aug 31 }, both at UTC midnight. */
export function monthBounds(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Expected YYYY-MM, got "${monthKey}"`);
  }
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    // Day 0 of the next month == last day of this one, so 28/29/30/31 is
    // handled without a leap-year special case.
    end: new Date(Date.UTC(year, month, 0)),
  };
}

/** Date -> "2026-08", the key used by the month picker. */
export function toMonthKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

/** "2026-08" -> "August 2026". */
export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const long = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${long[month - 1]} ${year}`;
}

/** Today at UTC midnight, for date-input defaults. */
export function todayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
