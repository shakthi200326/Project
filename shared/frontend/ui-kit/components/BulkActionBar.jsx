/**
 * What can be done to the rows currently picked out.
 *
 * Says how many are selected and offers whatever actions the caller passes.
 * It runs nothing itself, and deliberately provides no "apply to all"
 * mechanism: there are no bulk endpoints behind this yet, and a bar that
 * looped over the selection issuing one request each would look like a
 * single operation while being anything but -- half-applied on a failure,
 * with no way to say which half.
 *
 * So the actions are the caller's, and the caller is the one that has to be
 * honest about what they do.
 *
 * Appears only when something is selected; an empty bar would push the list
 * down for no reason.
 */
function BulkActionBar({ count = 0, onClear = null, children = null, noun = "row" }) {
  if (count === 0) return null;

  return (
    <div className="erp-bulk-bar" role="region" aria-label="Selected rows">
      <span className="erp-bulk-count">
        {count} {noun}
        {count === 1 ? "" : "s"} selected
      </span>

      <div className="erp-bulk-actions">
        {children}

        {onClear && (
          <button type="button" className="erp-bulk-clear" onClick={onClear}>
            Clear selection
          </button>
        )}
      </div>
    </div>
  );
}

export default BulkActionBar;
