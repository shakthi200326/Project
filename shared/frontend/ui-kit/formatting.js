/**
 * How the product writes dates, times and numbers.
 *
 * One place, for the same reason `describeError` is one place: the moment
 * two screens format a date themselves, they disagree, and an ERP where
 * the order list says 03/04 and the invoice says 04/03 is an ERP nobody
 * trusts with a number.
 *
 * Built on `Intl`, which the browser already has. No date library: the
 * formatting an ERP does is ordinary, and a dependency here would be one
 * more thing to keep current for the sake of what the platform does.
 *
 * Locale is a parameter everywhere and defaults to the browser's own. That
 * is the hook localization will use later -- a `locale` from the user's
 * profile threaded through these calls -- and it is why no component
 * formats anything itself. `Field` says the same thing from the other
 * side: display primitives present values, they do not invent them.
 *
 * Every function is total. Given nothing it returns an empty string rather
 * than "Invalid Date", and given something it cannot parse it hands back
 * what it was given: showing a raw value is honest, showing "NaN" is not.
 */

/** What an absent value looks like. */
export const EMPTY_MARK = "—";

/**
 * A `Date`, or `null`.
 *
 * The API sends ISO strings, so that is the common case; a `Date` passes
 * through, and a number is treated as epoch milliseconds.
 */
export function toDate(value) {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A number, or `null`. Decimal fields arrive from Django as strings. */
export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * A size a person reads: "5.0 GB", "812 KB", "640 B".
 *
 * One decimal below ten and none above, because "1,024 MB" and "1.0 GB"
 * are the same fact and only one of them is a size anybody pictures.
 * Null is `EMPTY_MARK`, never "0 B": nothing stored and nothing measured
 * are different answers.
 */
export function formatBytes(value) {
  if (value === null || value === undefined || value === "") return EMPTY_MARK;
  const n = toNumber(value);
  if (!Number.isFinite(n)) return EMPTY_MARK;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = n / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unit]}`;
}

/** The machine-readable form, for a `<time dateTime>` attribute. */
export function toISO(value, { dateOnly = false } = {}) {
  const date = toDate(value);
  if (!date) return undefined;
  return dateOnly ? date.toISOString().slice(0, 10) : date.toISOString();
}

export function formatDate(value, { locale, ...options } = {}) {
  const date = toDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(date);
}

export function formatDateTime(value, { locale, ...options } = {}) {
  const date = toDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(date);
}

export function formatNumber(value, { locale, ...options } = {}) {
  const number = toNumber(value);
  if (number === null) return "";

  return new Intl.NumberFormat(locale, options).format(number);
}

/**
 * An amount of money.
 *
 * The currency is required and is never guessed. A multi-currency ERP that
 * defaulted to one would render a supplier's EUR balance with a rupee sign
 * on the day someone forgot to pass it, and that is a mistake nobody spots
 * from the number alone.
 *
 * `Intl` decides the symbol, its side and the number of decimals from the
 * currency itself, which is how JPY gets none and KWD gets three without
 * this file holding a table of them.
 */
export function formatCurrency(value, currency, { locale, ...options } = {}) {
  const number = toNumber(value);
  if (number === null) return "";

  if (!currency) return formatNumber(number, { locale, ...options });

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...options,
  }).format(number);
}

/** The boundaries at which relative time changes unit, in seconds. */
const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/**
 * "3 days ago", "in 2 months".
 *
 * Useful for an activity trail, where how long ago is the question being
 * asked. Not for anything a person has to act on -- a due date is a date,
 * and "in 3 days" cannot be put in a diary.
 *
 * `now` is a parameter so this is testable without freezing the clock.
 */
export function formatRelativeTime(value, { locale, now = Date.now() } = {}) {
  const date = toDate(value);
  if (!date) return "";

  const seconds = (date.getTime() - now) / 1000;
  const magnitude = Math.abs(seconds);

  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  // Under a minute is "now" rather than "in 12 seconds": the precision
  // would be false anyway, given the clock is the viewer's own.
  if (magnitude < 60) return format.format(0, "second");

  const [unit, size] = UNITS.find(([, span]) => magnitude >= span) || [
    "minute",
    60,
  ];

  // Truncated, not rounded: 6 weeks is "last month", not "2 months ago".
  return format.format(Math.trunc(seconds / size), unit);
}
