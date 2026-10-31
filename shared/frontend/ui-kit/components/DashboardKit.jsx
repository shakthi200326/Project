/**
 * The dashboard language, as components.
 *
 * `dashboard.css` is the half of this that can be written as rules. This
 * is the half that cannot: which element carries which role, what an
 * absent figure renders as, and where the heading levels sit. Both the
 * platform console and the tenant workspace compose these, which is what
 * stops the two screens drifting into two designs.
 *
 * Everything here is presentational. Nothing fetches, nothing knows what a
 * tenant is, and nothing decides whether a figure may be shown -- the
 * screens own all three, because the rules differ between them and a
 * component that guessed would be wrong on one of the two.
 *
 * ## The one opinion worth stating
 *
 * `Stat` distinguishes three absences and refuses to collapse them:
 *
 *   `loading`      -- we do not know yet
 *   `unavailable`  -- you are not allowed to see this, or it is not measured
 *   value of 0     -- there are none
 *
 * A dashboard that prints 0 for the first two is lying twice, and it is
 * the most common lie dashboards tell. The third is a fact and is drawn as
 * a figure like any other.
 */

import Icon from "./Icon";
import Skeleton from "./Skeleton";

/* --------------------------------------------------------------------------
   Section
   -------------------------------------------------------------------------- */

/**
 * A titled region of a dashboard.
 *
 * The heading level is a prop because these nest under a page `h1` and the
 * level has to follow the document, not the styling -- an `h2` that looks
 * like an `h3` is fine; an `h3` with no `h2` above it is a broken outline.
 */
export function DashboardSection({
  title,
  subtitle = null,
  action = null,
  level: Heading = "h2",
  id = undefined,
  className = "",
  children,
}) {
  const labelId = id ? `${id}-title` : undefined;

  return (
    <section
      className={`erp-db-section ${className}`.trim()}
      aria-labelledby={labelId}
    >
      {(title || action) && (
        <div className="erp-db-section-head">
          {title && (
            <Heading className="erp-db-section-title" id={labelId}>
              {title}
            </Heading>
          )}
          {subtitle && <p className="erp-db-section-subtitle">{subtitle}</p>}
          {action && <div className="erp-db-section-action">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* --------------------------------------------------------------------------
   Figures
   -------------------------------------------------------------------------- */

/**
 * A row of figures on one surface.
 *
 * `columns` is the count at full width; the stylesheet reflows it to
 * three, then two, then one. It is passed as a custom property rather
 * than a class so any count works without a rule per number.
 *
 * Designed for four to six figures. Fewer than four still renders, but
 * the tablet breakpoint steps to a literal three columns -- `repeat()`
 * cannot take a math function -- so a row of two would be stretched
 * across three. A pair of figures wants a different arrangement anyway.
 */
export function StatRow({ columns = 4, className = "", children }) {
  return (
    <div
      className={`erp-db-stats ${className}`.trim()}
      style={{ "--erp-db-cols": columns }}
    >
      {children}
    </div>
  );
}

/**
 * One figure.
 *
 * `lead` promotes it -- tinted ground, brand rule, larger figure. One per
 * row. Two promoted figures in a row is the same as none.
 *
 * `to` makes the whole tile the link rather than putting a link inside it:
 * a 60px target beats a 90px line of text, and it means the hover state
 * and the click target are the same rectangle.
 */
export function Stat({
  label,
  value,
  note = null,
  icon = null,
  delta = null,
  lead = false,
  loading = false,
  unavailable = null,
  to = null,
  linkAs: Link = null,
  className = "",
}) {
  const classes = ["erp-db-stat", lead ? "is-lead" : "", className]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      <span className="erp-db-stat-label">
        {icon && <Icon name={icon} size={13} />}
        {label}
      </span>

      {loading ? (
        /* One line, and `half` -- `Skeleton`'s `width` is a named variant
           that becomes a class, not a length, so a percentage here would
           render a class that matches no rule and a line with no width. */
        <Skeleton lines={1} width="half" label="Loading figure" />
      ) : unavailable ? (
        /* Words, not a dash. A reader who cannot see a figure is owed the
           reason; a dash reads as "none" and is the wrong answer. */
        <span className="erp-db-stat-blocked">{unavailable}</span>
      ) : (
        <span className="erp-db-stat-value">{value}</span>
      )}

      {!loading && !unavailable && (delta || note) && (
        <span className="erp-db-stat-note">
          {delta}
          {delta && note ? " " : null}
          {note}
        </span>
      )}
    </>
  );

  if (to && Link && !loading && !unavailable) {
    return (
      <Link to={to} className={classes}>
        {body}
      </Link>
    );
  }

  return <div className={classes}>{body}</div>;
}

/**
 * A movement against a previous period.
 *
 * Deliberately dumb: it renders what it is given and never computes a
 * comparison. Whether a comparison exists at all is a question about the
 * data, and the screens answer it -- a dashboard that shows "+0%" because
 * it had nothing to compare against has invented a fact.
 */
export function Delta({ direction, children }) {
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";

  return (
    <span className={`erp-db-delta is-${direction}`}>
      <span aria-hidden="true">{arrow}</span>
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Panels
   -------------------------------------------------------------------------- */

export function DashboardPanel({
  title,
  subtitle = null,
  icon = null,
  action = null,
  flush = false,
  className = "",
  children,
}) {
  return (
    <section className={`erp-db-panel ${className}`.trim()} aria-label={title}>
      <div className="erp-db-panel-head">
        {icon && (
          <span className="erp-db-panel-icon" aria-hidden="true">
            <Icon name={icon} size={14} />
          </span>
        )}
        <div className="erp-db-panel-titles">
          <h3 className="erp-db-panel-title">{title}</h3>
          {subtitle && <span className="erp-db-panel-subtitle">{subtitle}</span>}
        </div>
        {action && <div className="erp-db-panel-action">{action}</div>}
      </div>
      <div className={`erp-db-panel-body${flush ? " is-flush" : ""}`}>
        {children}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Rows
   -------------------------------------------------------------------------- */

/**
 * One line in a panel: a thing, what about it, and where to go.
 *
 * Alerts, renewals, activity and at-risk lists are all this shape, which
 * is why there is one component rather than four that drifted.
 */
export function DataRow({
  severity = null,
  icon = null,
  title,
  note = null,
  value = null,
  meta = null,
  to = null,
  linkAs: Link = null,
}) {
  const body = (
    <>
      {severity && (
        <span className={`erp-db-sev is-${severity}`} aria-hidden="true">
          <Icon name={icon || severityIcon(severity)} size={14} />
        </span>
      )}
      {!severity && icon && (
        <span className="erp-db-sev is-neutral" aria-hidden="true">
          <Icon name={icon} size={14} />
        </span>
      )}

      <span className="erp-db-row-main">
        <span className="erp-db-row-title">{title}</span>
        {note && <span className="erp-db-row-note">{note}</span>}
      </span>

      {(value || meta) && (
        <span className="erp-db-row-end">
          {value && <span className="erp-db-row-value">{value}</span>}
          {meta && <span className="erp-db-row-meta">{meta}</span>}
        </span>
      )}
    </>
  );

  if (to && Link) {
    return (
      <Link to={to} className="erp-db-row">
        {body}
      </Link>
    );
  }

  return <div className="erp-db-row">{body}</div>;
}

/** The glyph a severity carries when the caller does not name one. */
function severityIcon(severity) {
  if (severity === "critical") return "alert";
  if (severity === "warning") return "bell";
  if (severity === "ok") return "check";
  return "info";
}

export function DataRows({ children, className = "" }) {
  return <div className={`erp-db-rows ${className}`.trim()}>{children}</div>;
}

/* --------------------------------------------------------------------------
   Meter
   -------------------------------------------------------------------------- */

/**
 * Usage against a cap.
 *
 * `used` or `limit` being null is the normal case, not an error: several
 * limits in this product have no counter behind them and several plans
 * have no cap. Both are drawn as a hatched track with the reason in the
 * value slot, rather than as an empty bar that reads as zero usage.
 */
export function UsageMeter({ label, used, limit, format = (v) => v }) {
  const measured = used !== null && used !== undefined;
  const capped = limit !== null && limit !== undefined;
  const share = measured && capped && Number(limit) > 0
    ? Math.min(Number(used) / Number(limit), 1)
    : null;

  const tone =
    share === null ? "unmeasured" : share >= 0.9 ? "critical" : share >= 0.75 ? "warning" : "ok";

  return (
    <div className={`erp-db-meter is-${tone}`}>
      <div className="erp-db-meter-head">
        <span className="erp-db-meter-label">{label}</span>
        <span className="erp-db-meter-value">
          {!measured
            ? "Not measured"
            : !capped
            ? `${format(used)} · no cap`
            : `${format(used)} of ${format(limit)}`}
        </span>
      </div>
      <div
        className="erp-db-meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={share === null ? undefined : Math.round(share * 100)}
        aria-valuemin={share === null ? undefined : 0}
        aria-valuemax={share === null ? undefined : 100}
      >
        {share !== null && (
          <div
            className="erp-db-meter-fill"
            style={{ width: `${Math.max(share * 100, 2)}%` }}
          />
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Empty
   -------------------------------------------------------------------------- */

/** Nothing to show, drawn as a result rather than as a failure. */
export function PanelEmpty({ icon = "check", title, note = null }) {
  return (
    <div className="erp-db-empty">
      <span className="erp-db-empty-icon" aria-hidden="true">
        <Icon name={icon} size={17} />
      </span>
      <span className="erp-db-empty-title">{title}</span>
      {note && <p className="erp-db-empty-note">{note}</p>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Layout
   -------------------------------------------------------------------------- */

/**
 * `primary` is a main thing beside a side thing, and is the one to reach
 * for. `even` is for two things of genuinely equal weight -- which is
 * rarer than dashboards usually assume.
 */
export function DashboardGrid({ variant = "primary", className = "", children }) {
  return (
    <div className={`erp-db-grid is-${variant} ${className}`.trim()}>
      {children}
    </div>
  );
}
