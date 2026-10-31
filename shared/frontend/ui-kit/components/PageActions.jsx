/**
 * The cluster of actions belonging to a page or a section.
 *
 * Layout only. What the actions are, whether the user may perform them and
 * whether they are available right now are all the caller's business --
 * this just keeps them together and in a predictable place, so "the primary
 * action is top right" holds across every module.
 *
 * Renders nothing when there is nothing to show, so a read-only screen does
 * not leave an empty row pushing its content down.
 */
function PageActions({ children, align = "end" }) {
  const hasChildren = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);

  if (!hasChildren) return null;

  return <div className={`erp-page-actions erp-page-actions-${align}`}>{children}</div>;
}

export default PageActions;
