/**
 * A band of figures on one surface, divided by hairlines instead of being
 * given a card each.
 *
 * A card per number reads as emphasis at three or four and as wallpaper at
 * a dozen: a grid of identical tiles says every figure matters equally,
 * which is the one thing a dashboard must never say. A strip puts the band
 * on one surface and separates its figures with a 1px rule, so the eye
 * reads a row of numbers -- and the emphasis saved can go to the one or two
 * figures that have earned it (`Metric`'s `lead`).
 *
 * The rules are the grid's own gap with the container showing through, so
 * they land correctly however the columns wrap.
 *
 *     <MetricStrip columns={4} footer={<PlanAllowance … />}>
 *       <Metric lead label="Customers" value="38" />
 *       …
 *     </MetricStrip>
 *
 * `footer` rides inside the same border: a breakdown that reads the figures
 * directly above it belongs under the same frame, not in a panel of its own.
 *
 * `columns` is the count at desktop width; the breakpoints take it to two
 * and then one, and a `lead` figure spans two of whatever is left. Budget
 * for it: a four-column band with a lead holds three more figures.
 */

function MetricStrip({ columns = 4, children, footer = null, className = "" }) {
  return (
    <div className={`erp-metrics-group ${className}`.trim()}>
      <div className="erp-metrics" style={{ "--erp-metrics-columns": columns }}>
        {children}
      </div>
      {footer}
    </div>
  );
}

export default MetricStrip;
