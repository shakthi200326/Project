/**
 * The row above a list: how you narrow it, and what you can do to it.
 *
 * Layout only, and slots rather than props with meaning -- it does not know
 * what a search box is, only that whatever it is given goes first and the
 * actions go last. That is what lets one toolbar serve a master data screen
 * and, later, a sales order list with entirely different controls.
 *
 * Renders nothing when every slot is empty, so a list with no search and no
 * filters does not get a blank strip above it.
 */
function ListToolbar({ search = null, filters = null, actions = null }) {
  if (!search && !filters && !actions) return null;

  return (
    <div className="erp-toolbar">
      {search}
      {filters}

      {actions && <div className="erp-toolbar-actions">{actions}</div>}
    </div>
  );
}

export default ListToolbar;
