/**
 * The spacing scale, for JavaScript that needs a step.
 *
 * References rather than values, for the reason `colors.js` gives: the scale
 * is declared once in `tokens.css` and this is its name map. The steps are
 * the ones the product already used -- nothing has been rescaled.
 */

const ref = (name) => `var(--erp-space-${name})`;

export const spacing = {
  xs: ref("xs"),
  sm: ref("sm"),
  md: ref("md"),
  lg: ref("lg"),
  xl: ref("xl"),
  xxl: ref("xxl"),
  xxxl: ref("xxxl"),
};
