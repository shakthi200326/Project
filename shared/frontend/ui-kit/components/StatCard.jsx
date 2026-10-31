/**
 * A concise KPI metric card for administrative and operational dashboards.
 *
 * Avoids bloated generic cards by packing key figures, status tone, delta trend,
 * and contextual hints into a clean ERP figure tile.
 */

import Icon from "./Icon";

export default function StatCard({
  label,
  value,
  hint = null,
  icon = "chart",
  tone = "accent",
  delta = null,
  onClick = null,
  className = "",
}) {
  const Tag = onClick ? "button" : "div";
  const numDelta = typeof delta === "number" ? delta : parseFloat(delta);
  const isUp = !isNaN(numDelta) && numDelta >= 0;

  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`erp-stat-card erp-stat-tone-${tone} ${onClick ? "is-clickable" : ""} ${className}`.trim()}
      onClick={onClick || undefined}
    >
      <div className="erp-stat-top">
        <span className="erp-stat-icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <span className="erp-stat-label">{label}</span>
      </div>

      <div className="erp-stat-value">{value}</div>

      {(hint || delta !== null) && (
        <div className="erp-stat-footer">
          {delta !== null && (
            <span className={`erp-stat-delta ${isUp ? "is-up" : "is-down"}`}>
              <Icon name={isUp ? "arrowUp" : "arrowDown"} size={12} />
              {typeof delta === "number" ? `${Math.abs(delta).toFixed(1)}%` : delta}
            </span>
          )}
          {hint && <span className="erp-stat-hint">{hint}</span>}
        </div>
      )}
    </Tag>
  );
}

