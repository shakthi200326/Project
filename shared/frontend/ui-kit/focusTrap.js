/**
 * Keeping focus inside something that is open over the page.
 *
 * Extracted from `Modal`, unchanged, because the navigation drawer needs
 * exactly the same contract and a second copy of it would be a second place
 * for the keyboard behaviour to drift. A dialog and a drawer differ in what
 * they look like and what they contain, not in what Tab does while they are
 * open.
 */

import { useEffect, useRef } from "react";

/** Everything the browser will let a user Tab to. */
export const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Everything inside `element` that the browser will let a user Tab to.
 *
 * A plain function rather than a `useCallback`: it closes over nothing, so
 * memoizing it bought an identity that the effects below then had to carry
 * as a dependency. Passing the element in keeps it honest about reading
 * `ref.current` at call time rather than at render time.
 *
 * No visibility filtering: `offsetParent` and friends need layout, which
 * jsdom does not do, so a filter written against them would behave one way in
 * tests and another in a browser. The selector's `:not([disabled])` is what
 * actually matters here.
 */
function focusableIn(element) {
  if (!element) return [];
  return Array.from(element.querySelectorAll(FOCUSABLE));
}

/**
 * Trap the keyboard inside `panel` while `open`, and close on Escape.
 *
 * Returns nothing: the caller owns the element and the open state, and this
 * owns what the keyboard may do with them.
 *
 * @param open    whether the panel is currently shown
 * @param onClose called for Escape
 * @param panel   ref to the element focus must stay within
 */
export function useFocusTrap({ open, onClose, panel }) {
  const openerRef = useRef(null);

  // Remember the opener before the panel takes focus, and put it back
  // afterwards. Read in a layout-independent effect so it is whatever was
  // focused at the moment `open` became true.
  useEffect(() => {
    if (!open) return undefined;

    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // The first control, or the panel itself when it is only text.
    const [first] = focusableIn(panel.current);
    if (first) {
      first.focus();
    } else if (panel.current) {
      panel.current.focus();
    }

    return () => {
      const opener = openerRef.current;
      // Still in the document: a row whose Edit button was removed by the
      // very save that closed this should not steal focus back.
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, panel]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = focusableIn(panel.current);
      if (elements.length === 0) {
        // Nothing to move to, so Tab must not leave either.
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      // Focus already outside the panel -- pull it back in rather than
      // letting the next Tab walk further into the page behind.
      if (!panel.current || !panel.current.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, panel]);
}
