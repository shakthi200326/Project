/**
 * One figure in a `MetricStrip`: a quiet label, the number, a hint under it.
 *
 * What it renders as follows from what it does, so a figure is never a
 * control that lies about itself:
 *
 *     as={Link} / as="a"   somewhere to go -- the whole figure is the
 *                          target, one tab stop rather than three
 *     onClick              something to do, so a real `button`
 *     neither              an `article`: a self-contained figure
 *
 * `as` keeps the design system free of a router import -- the caller passes
 * its own `Link` and any props it needs (`to`, `href`) ride along.
 *
 * `lead` gives the figure the band's emphasis: larger type, more room, and
 * two of the strip's columns. Use it for the one figure the band is really
 * about. `trailing` carries a decorative companion such as a sparkline;
 * give it one only where the same numbers are already readable nearby,
 * since a strip figure has no room for a table of its own.
 *
 * `tone` colours the icon, and only the icon. A figure is not more
 * important for being red -- it is only different, and the difference has
 * to mean something: overdue, over a cap, inactive.
 */

import Icon from "./Icon";

function Metric({
  label,
  value,
  hint = null,
  icon = null,
  tone = "neutral",
  as: Element = null,
  onClick = null,
  lead = false,
  trailing = null,
  className = "",
  ...rest
}) {
  const Tag = Element || (onClick ? "button" : "article");
  const classes = [
    "erp-metric",
    `erp-metric-${tone}`,
    lead ? "is-lead" : "",
    Element || onClick ? "is-interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      {...rest}
      type={Tag === "button" ? "button" : undefined}
      className={classes}
      onClick={onClick || undefined}
    >
      <span className="erp-metric-label">
        {icon && (
          <span className="erp-metric-icon" aria-hidden="true">
            <Icon name={icon} size={14} />
          </span>
        )}
        {label}
      </span>
      <span className="erp-metric-value">{value}</span>
      {hint && <span className="erp-metric-hint">{hint}</span>}
      {trailing && (
        <span className="erp-metric-trail" aria-hidden="true">
          {trailing}
        </span>
      )}
    </Tag>
  );
}

export default Metric;
