/**
 * A status pill.
 *
 * The same six tones `Alert` offers, so one status reads the same whether it
 * is announced in a banner or marked on a row. Before this there were three
 * -- success, muted, neutral -- and a list that needed to say "Failed" or
 * "Overdue" had nothing to reach for.
 *
 * ## Why the tone is checked rather than interpolated
 *
 * The class name used to be built straight from the prop, so a tone with no
 * rule behind it -- `tone="warning"` was one, in the product, on the People
 * screen -- produced `erp-badge-warning`, matched nothing, and rendered as an
 * unstyled pill. Nothing failed; the badge just quietly lost its colour.
 *
 * An unknown tone now falls back to `neutral`, which is visible and legible,
 * rather than to no styling at all. A typo becomes a wrong-looking badge
 * instead of an invisible one.
 */

/** The tones that have a rule behind them in `design-system.css`. */
const TONES = ["neutral", "muted", "success", "warning", "danger", "info"];

function Badge({ children, tone = "neutral" }) {
  const resolved = TONES.includes(tone) ? tone : "neutral";

  return <span className={`erp-badge erp-badge-${resolved}`}>{children}</span>;
}

export default Badge;
