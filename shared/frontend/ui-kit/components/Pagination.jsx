/**
 * Page controls driven by the `meta` block every list endpoint returns.
 *
 * Renders nothing but the count when there is only one page: a control that
 * can never be used is noise.
 *
 * The page-size chooser is opt-in. Without `onPageSizeChange` this is the
 * component it has always been, so callers that have no opinion about page
 * size are unaffected. The options stop at 100 because the API caps
 * `?size=` there -- offering "All" would be offering something the server
 * will quietly refuse.
 */

/** Sizes the API will actually honour. StandardPagination caps at 100. */
const PAGE_SIZES = [20, 50, 100];

function Pagination({
  meta,
  onChange,
  onPageSizeChange = null,
  pageSizes = PAGE_SIZES,
}) {
  const {
    page = 1,
    total_pages: totalPages = 1,
    count = 0,
    page_size: pageSize = null,
  } = meta || {};

  const sizeChooser = onPageSizeChange && (
    <label className="erp-page-size">
      Rows
      <select
        value={pageSize ?? ""}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
      >
        {pageSizes.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );

  if (totalPages <= 1) {
    return (
      <div className="erp-pagination">
        <span className="erp-pagination-summary">{count} record(s)</span>
        {sizeChooser}
      </div>
    );
  }

  return (
    // A landmark only when there is somewhere to navigate to. The
    // single-page block above stays a plain div: it is a count, not a
    // control, and a landmark wrapping one thing to read is noise.
    <nav className="erp-pagination" aria-label="Pagination">
      <span className="erp-pagination-summary">
        {count} record(s) &middot; page {page} of {totalPages}
      </span>

      <div className="erp-pagination-buttons">
        {sizeChooser}

        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
