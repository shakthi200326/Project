/**
 * The colour tokens, for JavaScript that needs one.
 *
 * These are **references**, not values. `colors.primary` is the string
 * `"var(--erp-color-primary)"`, which is what a React `style` prop wants:
 *
 *     <span style={{ color: colors.primary }} />
 *
 * That is the whole point of the change. This file used to hold a second
 * copy of the palette as hex literals, which nothing imported and nothing
 * kept in step with the CSS -- so it quietly described a product that no
 * longer existed. Now there is one declaration, in `tokens.css`, and this
 * is the name map for it. A value changed there changes here for free.
 *
 * Prefer a class over an inline style wherever a class will do. This exists
 * for the cases where it will not -- a chart colour, a computed style.
 */

const ref = (name) => `var(--erp-color-${name})`;

export const colors = {
  primary: ref("primary"),
  primaryStrong: ref("primary-strong"),
  primarySurface: ref("primary-surface"),
  onPrimary: ref("on-primary"),

  background: ref("background"),
  surface: ref("surface"),
  surfaceMuted: ref("surface-muted"),

  text: ref("text"),
  textSecondary: ref("text-secondary"),
  textMuted: ref("text-muted"),
  textSubtle: ref("text-subtle"),

  border: ref("border"),
  borderStrong: ref("border-strong"),

  success: ref("success"),
  warning: ref("warning"),
  danger: ref("danger"),
  info: ref("info"),

  // Kept from the original token file so an existing name does not break.
  secondary: ref("text-muted"),
};
