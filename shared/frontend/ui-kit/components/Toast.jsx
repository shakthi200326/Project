import Icon from "./Icon";

/**
 * One transient message.
 *
 * Presentational and stateless: it does not know how long it will live or
 * what replaces it. `ToastProvider` owns that, which is what lets the same
 * component be rendered in a test with no timers running.
 *
 * No `role` of its own -- the region it sits in is the live region, and a
 * nested one would make some screen readers announce the message twice.
 */
function Toast({ message, tone = "success", onDismiss = null }) {
  return (
    <div className={`erp-toast erp-toast-${tone}`}>
      <span className="erp-toast-message">{message}</span>

      {onDismiss && (
        <button
          type="button"
          className="erp-toast-close"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

export default Toast;
