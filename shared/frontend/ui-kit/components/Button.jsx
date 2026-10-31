/**
 * The product's command control.
 *
 * Variants say what the action means, not what colour it is: `primary` is
 * the one thing this screen is for, `secondary` is everything else, and
 * `danger` is the one that destroys something. A screen picking a colour
 * directly is how two modules end up disagreeing about which button is the
 * important one.
 *
 * `loading` is the state between a click and the server answering. It
 * disables the button -- submitting twice is how one invoice becomes two --
 * and says so rather than only spinning: a control that looks identical
 * while busy invites the second click that the disable exists to prevent.
 */

import Spinner from "./Spinner";

function Button({
  children,
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  loadingLabel = null,
  variant = "primary",
  size = "md",
  title = undefined,
}) {
  const busy = Boolean(loading);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={`erp-button erp-button-${variant} erp-button-${size}`}
      // The button is disabled while busy, so a screen reader will not be
      // told about the change unless we say it: `aria-busy` is what marks
      // this as "working", distinct from "not available to you".
      aria-busy={busy || undefined}
    >
      {busy && <Spinner size="sm" />}
      {busy && loadingLabel ? loadingLabel : children}
    </button>
  );
}

export default Button;
