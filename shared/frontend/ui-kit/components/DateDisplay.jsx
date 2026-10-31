/**
 * A date, or a date and time, written the way the product writes them.
 *
 * A `<time>` element, so the machine-readable value is in the markup
 * alongside the human one. That is what lets a value be copied, indexed or
 * read back correctly regardless of how it happens to be formatted on
 * screen -- and it costs one attribute.
 *
 *     <Field label="Opened" value={<DateDisplay value={record.opened_on} />} />
 *     <DateDisplay value={record.created_at} withTime />
 */

import { EMPTY_MARK, formatDate, formatDateTime, toISO } from "../formatting";

function DateDisplay({
  value,
  withTime = false,
  locale = undefined,
  emptyText = "Not set",
  options = undefined,
}) {
  const iso = toISO(value, { dateOnly: !withTime });

  if (!iso) {
    // A value that will not parse is shown as it arrived rather than as a
    // blank: a malformed date is a data problem somebody needs to see.
    if (value !== null && value !== undefined && value !== "") {
      return <span>{String(value)}</span>;
    }

    return (
      <>
        <span aria-hidden="true">{EMPTY_MARK}</span>
        <span className="erp-visually-hidden">{emptyText}</span>
      </>
    );
  }

  const text = withTime
    ? formatDateTime(value, { locale, ...options })
    : formatDate(value, { locale, ...options });

  return <time dateTime={iso}>{text}</time>;
}

export default DateDisplay;
