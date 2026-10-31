/**
 * How a total divides: one proportional bar, and the legend that reads it.
 *
 * A row of boxed counters answers "how many are suspended" once per box and
 * never answers "what does the whole look like". The bar answers the second
 * question at a glance, and the legend still carries every exact figure, so
 * drawing it once loses nothing.
 *
 * The bar is decorative. The legend below it is real text and is what a
 * screen reader reads, so the figures need no duplicate label.
 *
 * `items` are `{label, value, tone}`. A zero keeps its legend row -- zero is
 * an answer -- but takes no width in the bar. Filtering out the parts that
 * do not apply is the caller's job: a part that is absent and a part that
 * is empty are different facts and only the caller knows which it has.
 */

function Composition({ items, format = (value) => value }) {
  const rows = items.filter(Boolean);
  const share = rows.filter((row) => Number(row.value) > 0);

  return (
    <div className="erp-composition">
      {share.length > 0 && (
        <div className="erp-composition-bar" aria-hidden="true">
          {share.map((row) => (
            <span
              key={row.label}
              className={`erp-comp-${row.tone || "neutral"}`}
              style={{ flexGrow: Number(row.value) }}
            />
          ))}
        </div>
      )}
      <ul className="erp-composition-legend">
        {rows.map((row) => (
          <li key={row.label}>
            <span className={`erp-comp-swatch erp-comp-${row.tone || "neutral"}`} aria-hidden="true" />
            <span className="erp-composition-label">{row.label}</span>
            <span className="erp-composition-value">{format(row.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Composition;
