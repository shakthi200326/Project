/**
 * One action on a record, drawn as its icon.
 *
 * The control a table row, a card or a toolbar uses for View, Edit, Manage,
 * Delete and the rest -- the same size, the same hover and the same symbol
 * for the same action everywhere, instead of a row of word buttons that
 * wraps the moment a column gets narrow.
 *
 *     <RowActions>
 *       <IconAction icon="view" label={`View ${row.name}`} onClick={...} />
 *       <IconAction icon="edit" label={`Edit ${row.name}`} to={editPath} />
 *       <IconAction icon="delete" tone="danger" label="Delete" onClick={...} />
 *     </RowActions>
 *
 * `label` is required and is both the accessible name and the tooltip: an
 * icon alone is not a name, and someone who does not recognise the symbol
 * can hover to find out. `icon` is a name from `actionIcons.js`, or any
 * icon component for the one-off case.
 *
 * Given `to` it is a link -- through the router when the application has
 * provided one (`linking.js`), so it never reloads the page -- and given
 * `onClick` a button.
 */

import { createElement } from "react";

import { ACTION_ICONS } from "../actionIcons";
import { useLinkComponent } from "../linking";

function IconAction({
  icon,
  label,
  onClick = undefined,
  to = null,
  tone = "default",
  disabled = false,
  pressed = undefined,
  size = 16,
  className = "",
}) {
  const Link = useLinkComponent(null);
  const Glyph = typeof icon === "string" ? ACTION_ICONS[icon] : icon;

  const classes = ["erp-icon-action", `erp-icon-action-${tone}`, className]
    .filter(Boolean)
    .join(" ");

  // Decoration once the control has a name -- announcing both would read
  // the action out twice.
  // `createElement` rather than JSX: the glyph and the link are looked up,
  // not defined here, and JSX on a looked-up name reads like a component
  // being created on every render.
  const glyph = Glyph
    ? createElement(Glyph, { size, strokeWidth: 2, "aria-hidden": true, focusable: "false" })
    : null;

  if (to && !disabled) {
    const target = Link ? { to } : { href: to };
    return createElement(
      Link || "a",
      { ...target, className: classes, "aria-label": label, title: label, onClick },
      glyph
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
      // Only for a toggle (show/hide): an on/off state a screen reader can
      // report, rather than a label that changes under the user.
      aria-pressed={pressed}
      aria-label={label}
      title={label}
    >
      {glyph}
    </button>
  );
}

/**
 * The actions of one row, together.
 *
 * Clicks and Enter inside it stop here: on a table whose rows open on click
 * the row must not open as well when one of its actions is pressed.
 */
export function RowActions({ children, className = "" }) {
  const stop = (event) => event.stopPropagation();
  return (
    <div
      className={["erp-icon-actions", className].filter(Boolean).join(" ")}
      onClick={stop}
      onKeyDown={stop}
      role="presentation"
    >
      {children}
    </div>
  );
}

export default IconAction;
