/**
 * "Rows are on their way", drawn as a small table being filled in.
 *
 * A grid of cells that light up in a diagonal wave under a sweeping scan
 * line -- the shape of the thing that is about to appear, rather than a
 * spinner that could be standing in for anything.
 *
 * Two placements:
 *
 *     <TableLoader />            a block of its own, for a table that has
 *                                nothing to show yet
 *     <TableLoader overlay />    laid over rows already on screen, which keep
 *                                their place (so nothing shifts) but cannot
 *                                be clicked until the answer arrives
 *
 * The overlay fades in after a short delay, so an answer that comes back
 * quickly never flashes it. The wording is a polite live region; when
 * something else on the screen is already announcing the same wait -- a
 * search field saying "Searching..." -- pass `announce={false}` and the
 * loader is drawn without being read out a second time.
 */

const ROWS = 3;
const COLUMNS = 4;
const CELLS = Array.from({ length: ROWS * COLUMNS }, (_, index) => ({
  row: Math.floor(index / COLUMNS),
  column: index % COLUMNS,
}));

function TableLoader({ label = "Loading data...", overlay = false, announce = true }) {
  const live = announce ? { role: "status", "aria-live": "polite" } : { "aria-hidden": true };

  return (
    <div
      className={`erp-table-loader${overlay ? " erp-table-loader-overlay" : ""}`}
      {...live}
    >
      <div className="erp-table-loader-card">
        <div className="erp-table-loader-grid" aria-hidden="true">
          <span className="erp-table-loader-head" />
          {CELLS.map(({ row, column }) => (
            <span
              key={`${row}-${column}`}
              className="erp-table-loader-cell"
              style={{ "--erp-loader-step": row + column }}
            />
          ))}
          <span className="erp-table-loader-scan" />
        </div>
        {label && <span className="erp-table-loader-label">{label}</span>}
      </div>
    </div>
  );
}

export default TableLoader;
