/**
 * Responsive grid container for StatCard components.
 */

export default function StatGrid({ children, columns = 4, className = "" }) {
  return (
    <div
      className={`erp-stat-grid ${className}`.trim()}
      style={{ "--erp-stat-columns": columns }}
    >
      {children}
    </div>
  );
}

