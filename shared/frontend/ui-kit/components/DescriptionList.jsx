/**
 * Record data in read mode: labels and their values.
 *
 * A real `<dl>`, because that is what this is. The alternative everybody
 * reaches for -- a grid of divs with a bold span -- looks identical and
 * tells a screen reader nothing about which value belongs to which label,
 * which on a record screen is the only information there is.
 *
 * Layout is a grid that reflows on its own: columns are as many as fit at
 * a readable width, so it is one column on a phone and three on a desktop
 * without a breakpoint deciding where those are. That keeps this out of
 * the business of knowing how wide the page it sits in happens to be.
 *
 *     <DescriptionList>
 *       <Field label="Code" value={record.code} />
 *       <Field label="Status" value={<Badge tone="success">Active</Badge>} />
 *     </DescriptionList>
 */
function DescriptionList({ children, columns = "auto" }) {
  return (
    <dl className={`erp-description-list erp-description-list-${columns}`}>
      {children}
    </dl>
  );
}

export default DescriptionList;
