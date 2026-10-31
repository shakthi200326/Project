/**
 * The product's one icon set.
 *
 * Every glyph in ONE ERP comes from here: the navigation rail, the
 * administration area, notifications, the header. One family -- a 24-unit
 * box, stroked in `currentColor`, round caps and joins, no fills -- because
 * an icon set assembled from several sources is worse than none: the eye
 * reads the inconsistency before it reads the meaning.
 *
 * Drawn inline rather than taken from a package. A hundred paths cost a few
 * kilobytes and ship no runtime; the product's constraint is no large icon
 * libraries and no new dependencies.
 *
 * Decorative by default (`aria-hidden`), because an icon normally sits
 * beside its own label. Pass `label` when the icon is the only thing a
 * control says. An unknown name renders nothing rather than a placeholder:
 * a missing glyph should look like a missing glyph, not like a broken one.
 *
 *     <Icon name="receipt" />
 *     <Icon name="x" size={14} />
 *     <Icon name="trash" label="Delete" />
 *
 * The glyphs themselves live in `../iconPaths.jsx`.
 */

import { PATHS } from "../iconPaths";

function Icon({ name, size = 18, strokeWidth = 2, label = null, className = "" }) {
  const paths = PATHS[name];
  if (!paths) return null;

  return (
    <svg
      className={`erp-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {Array.isArray(paths) ? paths.map((d) => <path key={d} d={d} />) : paths}
    </svg>
  );
}

export default Icon;
