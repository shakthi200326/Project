/**
 * A table of records.
 *
 * Generic on purpose: it knows about columns, sorting and selection, and
 * nothing about what a row means. A column says how to draw itself with
 * `render(row)`; without one the raw `row[key]` is shown, which is what
 * this component has always done and what keeps existing callers working.
 *
 * Every added capability is opt-in. A caller that passes only `columns` and
 * `data` gets exactly the table it got before: no sort controls, no
 * checkbox column, no change in markup.
 *
 * Sorting is reported, never performed. The rows on screen are one page of
 * a server-side result, so sorting them here would reorder a twentieth of
 * the data and look like it had done the job -- worse than not offering it.
 *
 * `loading` is opt-in too, and only a caller that passes it gets the extra
 * wrapper it needs -- always present from then on, so the table is never
 * remounted (and its scroll position lost) as a request starts and ends.
 * With no rows yet the loader takes the table's place; with rows on screen
 * it is laid over them, which keeps their height and takes their clicks.
 */

import TableLoader from "./TableLoader";

const NONE = "";

function SortButton({ column, sort, onSortChange }) {
  const ascending = sort === column.key;
  const descending = sort === `-${column.key}`;

  // The arrow is decoration; the state is announced through aria-sort on
  // the header cell, so a screen reader is not told "triangle".
  const marker = ascending ? "↑" : descending ? "↓" : "↕";

  return (
    <button
      type="button"
      className="erp-table-sort"
      onClick={() => onSortChange(column.key)}
    >
      {column.label}
      <span aria-hidden="true" className="erp-table-sort-marker">
        {marker}
      </span>
    </button>
  );
}

function Table({
  columns = [],
  data = [],
  sort = NONE,
  onSortChange = null,
  selection = null,
  getRowId = (row, index) => row.id ?? index,
  label = "Records",
  loading = undefined,
  loadingLabel = undefined,
  announceLoading = true,
}) {
  const selectable = Boolean(selection);

  const ariaSort = (column) => {
    if (!onSortChange || !column.sortable) return undefined;
    if (sort === column.key) return "ascending";
    if (sort === `-${column.key}`) return "descending";
    return "none";
  };

  if (loading && data.length === 0) {
    return <TableLoader label={loadingLabel} announce={announceLoading} />;
  }

  const table = (
    // Below a phone width each row becomes a stacked card with every value
    // named by its column, rather than a sideways scroll through columns the
    // reader cannot see -- same markup, same table semantics, different
    // layout. See `.erp-table-scroll` in `design-system.css`.
    //
    // An ERP table is wide, and the window it is in may not be. Scrolling
    // the table rather than the page keeps the rest of the screen still --
    // and the wrapper is focusable with a name, because a region that can
    // only be scrolled by dragging cannot be scrolled by keyboard at all.
    <div
      className="erp-table-scroll"
      role="region"
      aria-label={label}
      aria-busy={loading || undefined}
      // Out of the tab order and unclickable while it is being replaced;
      // the overlay is what the pointer meets instead.
      inert={loading || undefined}
      tabIndex={0}
    >
      <table className="erp-table">
        <thead>
          <tr>
            {selectable && (
              <th className="erp-table-select">
                <input
                  type="checkbox"
                  aria-label="Select all rows on this page"
                  checked={selection.allOnPageSelected}
                  onChange={selection.togglePage}
                />
              </th>
            )}

            {columns.map((column) => (
              <th key={column.key} aria-sort={ariaSort(column)}>
                {onSortChange && column.sortable ? (
                  <SortButton
                    column={column}
                    sort={sort}
                    onSortChange={onSortChange}
                  />
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row, index) => {
            const id = getRowId(row, index);
            const checked = selectable && selection.isSelected(id);

            return (
              <tr key={id} className={checked ? "erp-table-row-selected" : undefined}>
                {selectable && (
                  <td className="erp-table-select">
                    <input
                      type="checkbox"
                      aria-label={`Select row ${index + 1}`}
                      checked={checked}
                      onChange={() => selection.toggle(id)}
                    />
                  </td>
                )}

                {columns.map((column) => (
                  // `data-label` is what lets a narrow screen stack the row
                  // into a card with each value named. It carries the same
                  // word the column header already shows, so the label is
                  // never a second thing to keep in step -- and on a wide
                  // screen CSS ignores it entirely.
                  <td key={column.key} data-label={column.label || undefined}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (loading === undefined) return table;

  return (
    <div className="erp-table-loading">
      {table}
      {loading && (
        <TableLoader overlay label={loadingLabel} announce={announceLoading} />
      )}
    </div>
  );
}

export default Table;
