/**
 * The way out of a record screen.
 *
 * Breadcrumbs say where you are; this is the one-click way back to where
 * you came from, which on a detail screen is almost always the list. Both
 * earn their place -- the trail is orientation, this is an action -- and
 * having a single obvious way back is what stops people using the
 * browser's Back button to escape a half-filled form.
 *
 * Router-free, like `Breadcrumbs`: the design system must stay usable
 * without one. The application provides its router's link once, through
 * `LinkComponentProvider`, or a caller passes `linkComponent={Link}`;
 * failing both it is a plain anchor, which navigates correctly but reloads
 * the whole page.
 *
 * Given `onClick` instead of `to` it becomes a button -- for going back to
 * a previous step rather than to an address. It is deliberately not
 * `navigate(-1)` by default: browser history is not the same thing as the
 * list this record belongs to, and after arriving from a link it leads
 * somewhere unrelated.
 */
import { createElement } from "react";

import { useLinkComponent } from "../linking";

function BackLink({ to = null, label, onClick = null, linkComponent = null, className = "" }) {
  // The application's router link when it has provided one -- see
  // `linking.js` -- so going back does not reload the whole shell.
  const Link = useLinkComponent(linkComponent);

  // The arrow is decoration; the label is the name of the control, so a
  // screen reader hears "Back to customers" and not "left arrow".
  const content = (
    <>
      <span aria-hidden="true" className="erp-back-arrow">
        &larr;
      </span>
      {label}
    </>
  );

  const classes = ["erp-back-link", className].filter(Boolean).join(" ");

  if (!to) {
    if (!onClick) return null;

    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }

  if (Link) {
    // `createElement`: the link component is provided, not defined here.
    return createElement(
      Link,
      { to, className: classes, onClick: onClick || undefined },
      content
    );
  }

  return (
    <a href={to} className={classes} onClick={onClick || undefined}>
      {content}
    </a>
  );
}

export default BackLink;
