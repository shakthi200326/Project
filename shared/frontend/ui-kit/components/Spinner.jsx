/**
 * A busy indicator.
 *
 * Purely decorative: it is marked `aria-hidden` because a spinning circle
 * tells a screen reader nothing. Whatever is waiting says so in words --
 * see `LoadingState`, which pairs this with a live region.
 */
function Spinner({ size = "md" }) {
  return <span className={`erp-spinner erp-spinner-${size}`} aria-hidden="true" />;
}

export default Spinner;
