/**
 * How long ago something happened.
 *
 * For an activity trail, where "3 days ago" is the question being asked
 * and a timestamp is not. The exact moment stays available in the
 * element's `title` and in its `dateTime`, so nothing is lost by writing
 * it this way -- which matters on an audit trail, where the precise time
 * is occasionally the whole point.
 *
 * Formatted once, when it renders. There is no timer: an ERP screen is not
 * a chat window, and a hundred rows each waking up once a minute to redraw
 * "4 minutes ago" is a cost with no reader. A screen that needs the clock
 * to tick can re-render itself.
 */

import {
  EMPTY_MARK,
  formatDateTime,
  formatRelativeTime,
  toISO,
} from "../formatting";

function RelativeTime({
  value,
  locale = undefined,
  now = undefined,
  emptyText = "Not set",
}) {
  const iso = toISO(value);

  if (!iso) {
    return (
      <>
        <span aria-hidden="true">{EMPTY_MARK}</span>
        <span className="erp-visually-hidden">{emptyText}</span>
      </>
    );
  }

  const relative = formatRelativeTime(value, { locale, now });
  const absolute = formatDateTime(value, { locale });

  return (
    <time dateTime={iso} title={absolute}>
      {relative}
    </time>
  );
}

export default RelativeTime;
