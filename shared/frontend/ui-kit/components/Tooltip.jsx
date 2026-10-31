/**
 * A short explanation attached to a control.
 *
 * For the things an ERP screen cannot afford to spell out in place: what an
 * icon-only action does, what a truncated cell says in full, what a column
 * heading means. Not for anything a user must read to complete a task --
 * a tooltip is invisible to touch, absent from print, and gone the moment
 * the pointer moves. Required information belongs in help text on the
 * field, which `FormField` already provides.
 *
 *     <Tooltip text="Reverses the posting">
 *       <Button variant="secondary">Reverse</Button>
 *     </Tooltip>
 *
 * The child is the trigger and keeps its own behaviour: this attaches
 * handlers and an `aria-describedby`, and renders nothing else around it
 * that could change layout.
 *
 * **Describes, never names.** `aria-describedby` rather than
 * `aria-labelledby`, because a tooltip is extra detail about a control that
 * already has a name. A control whose *only* name would be its tooltip is a
 * control that needs `aria-label` instead -- which is exactly what
 * `IconButton` does, and why an icon button does not need one of these.
 *
 * Shows on hover **and on focus**, because a keyboard user reaches the
 * trigger without a pointer ever being near it. Escape dismisses it while
 * the trigger keeps focus, per the APG: a tooltip that cannot be dismissed
 * can cover the content underneath it with no way back.
 */

import { cloneElement, useCallback, useEffect, useId, useState } from "react";

function Tooltip({ text, children, placement = "top" }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  // Dismissible while it is showing, and only then: a document-level
  // listener that outlives the tooltip would swallow Escape for whatever
  // else wanted it -- an open dialog, most obviously.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, hide]);

  // Nothing to say, so nothing is attached. A wrapper that existed only to
  // hold an empty tooltip would still affect layout.
  if (!text) return children;

  const trigger = cloneElement(children, {
    "aria-describedby": open ? id : undefined,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  });

  return (
    <span className="erp-tooltip-anchor">
      {trigger}

      {open && (
        // `role="tooltip"` on the bubble, not on the trigger. It is only
        // ever reached through the describedby above, never by tabbing.
        <span role="tooltip" id={id} className={`erp-tooltip erp-tooltip-${placement}`}>
          {text}
        </span>
      )}
    </span>
  );
}

export default Tooltip;
