/**
 * The outer container every ERP screen sits in.
 *
 * Owns nothing but spacing and width, which is the point: a module screen
 * should not be deciding how far from the sidebar it starts, and two that
 * decided differently is how an ERP ends up looking like several products.
 */
function Page({ children, className = "", wide = false }) {
  const classes = ["erp-page", wide ? "is-wide" : "", className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}

export default Page;
