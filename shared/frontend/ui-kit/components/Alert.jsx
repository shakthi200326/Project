/**
 * A standing message about the thing on screen.
 *
 * For facts that stay true while you look at them: "This customer is on
 * credit hold", "This period is closed", "Changes here affect every
 * company". That is what separates it from the two neighbours it is
 * otherwise easy to confuse it with:
 *
 *   - a `Toast` is transient feedback about something that just happened,
 *     and disappears on a timer;
 *   - an `ErrorState` replaces the content that failed to load, and takes
 *     an error object so every screen phrases a failure the same way.
 *
 * An Alert sits *beside* content that is perfectly fine.
 *
 * Not a live region by default. Most of these are on the page from the
 * moment it renders, and announcing every one of them on arrival is how a
 * screen reader user learns to tune the product out. `live` is there for
 * the ones that genuinely appear in response to something -- and even then
 * only if nothing else is already saying it.
 */

import Icon from "./Icon";
import IconButton from "./IconButton";

function Alert({
  tone = "info",
  title = null,
  children = null,
  action = null,
  onDismiss = null,
  live = false,
  dismissLabel = "Dismiss message",
}) {
  if (!title && !children) return null;

  return (
    <div
      className={`erp-alert erp-alert-${tone}`}
      role={live ? (tone === "danger" ? "alert" : "status") : undefined}
    >
      <div className="erp-alert-body">
        {title && <p className="erp-alert-title">{title}</p>}
        {children && <div className="erp-alert-message">{children}</div>}
        {action && <div className="erp-alert-action">{action}</div>}
      </div>

      {onDismiss && (
        <IconButton label={dismissLabel} onClick={onDismiss}>
          <Icon name="x" size={16} />
        </IconButton>
      )}
    </div>
  );
}

export default Alert;
