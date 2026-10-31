/**
 * The type scale, for JavaScript that needs a size or a weight.
 *
 * References rather than values -- see `colors.js`.
 *
 * `fontFamily` is where the Inter/Arial contradiction was resolved. The old
 * token declared Inter and nothing read it, while the document rendered in
 * bare Arial from a rule in the shell's stylesheet. There is now one stack,
 * in `tokens.css`, applied to `body` in `base.css`: Inter when the machine
 * has it, then the platform's own UI face. Bundling Inter as a webfont is a
 * separate decision with network and offline consequences, and is not this
 * cleanup's to make.
 */

const size = (name) => `var(--erp-font-size-${name})`;
const weight = (name) => `var(--erp-font-weight-${name})`;

export const typography = {
  fontFamily: "var(--erp-font-sans)",

  sizes: {
    micro: size("micro"),
    xs: size("xs"),
    sm: size("sm"),
    md: size("md"),
    lg: size("lg"),
    xl: size("xl"),
    xxl: size("xxl"),
  },

  weights: {
    regular: weight("regular"),
    medium: weight("medium"),
    semibold: weight("semibold"),
    bold: weight("bold"),
  },
};
