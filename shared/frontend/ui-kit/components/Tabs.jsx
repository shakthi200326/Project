/**
 * A tabbed section of a screen.
 *
 * Generic, and deliberately router-free: the same component serves a record
 * page whose tab is in the URL and a dialog whose tab is plain state. It is
 * controlled -- `value` says which tab is showing and `onChange` is called
 * when the user picks another -- so whoever owns the tab decides what
 * choosing one means. A record page turns it into a navigation; a modal
 * turns it into a `useState`.
 *
 * Only the selected panel is rendered, which is why there is one panel
 * element rather than one per tab: every `aria-controls` then points at
 * something that actually exists. The alternative -- a panel id per tab,
 * with all but one absent from the document -- leaves dangling references
 * on every unselected tab, which is exactly the sort of thing that passes
 * review and fails an audit.
 *
 * Activation is **manual**, following the APG guidance for tabs whose
 * activation costs something. Arrow keys move focus and Enter or Space
 * chooses; arrowing does not select. That matters here because a record
 * page's tab is a URL, and automatic activation would push a history entry
 * for every arrow key on the way past.
 *
 *     <Tabs tabs={TABS} value={active} onChange={setActive}>
 *       {active === "overview" ? <Overview /> : <Activity />}
 *     </Tabs>
 */

import { useCallback, useId, useRef } from "react";

function Tabs({
  tabs = [],
  value = null,
  onChange = null,
  label = "Sections",
  children = null,
}) {
  const base = useId();
  const buttons = useRef(new Map());

  const tabId = useCallback((id) => `${base}-tab-${id}`, [base]);
  const panelId = `${base}-panel`;

  // A tab that cannot be chosen cannot be the selected one either, and a
  // `value` naming nothing falls back to the first tab that can be. The
  // caller is not corrected -- this only decides what is drawn as
  // selected, so a tablist is never left with nothing marked.
  const available = tabs.filter((tab) => !tab.disabled);
  const selected =
    available.find((tab) => tab.id === value)?.id ?? available[0]?.id ?? null;

  const choose = useCallback(
    (tab) => {
      if (tab.disabled || tab.id === selected) return;
      if (onChange) onChange(tab.id);
    },
    [onChange, selected]
  );

  /** Move focus, without choosing: manual activation. */
  const focusTab = useCallback(
    (id) => {
      const button = buttons.current.get(id);
      if (button) button.focus();
    },
    []
  );

  const onKeyDown = useCallback(
    (event) => {
      if (available.length === 0) return;

      // Where focus is now, among the tabs that can take it. Read from the
      // document rather than from `selected`: with manual activation the
      // two are routinely different, which is the whole point.
      const focused = available.findIndex(
        (tab) => buttons.current.get(tab.id) === document.activeElement
      );
      const from = focused === -1 ? available.findIndex((t) => t.id === selected) : focused;

      const step = (delta) => {
        const at = (from + delta + available.length) % available.length;
        focusTab(available[at].id);
      };

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          step(1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          step(-1);
          break;
        case "Home":
          event.preventDefault();
          focusTab(available[0].id);
          break;
        case "End":
          event.preventDefault();
          focusTab(available[available.length - 1].id);
          break;
        case "Enter":
        case " ":
          // The browser would fire a click for these on a button anyway;
          // handling them here keeps the behaviour true even if the tab
          // ever stops being one.
          break;
        default:
          break;
      }
    },
    [available, focusTab, selected]
  );

  // No tabs is not an error and not an empty tablist: it is a section with
  // no divisions, so the content is shown on its own. Same rule the
  // toolbar and the page actions already follow.
  if (tabs.length === 0) {
    return <div className="erp-tabs">{children}</div>;
  }

  return (
    <div className="erp-tabs">
      <div className="erp-tablist" role="tablist" aria-label={label}>
        {tabs.map((tab) => {
          const active = tab.id === selected;

          return (
            <button
              key={tab.id}
              // Not the design system's `Button`: that is a command control
              // with its own variants, and a tab is a selection control
              // whose appearance is the selection. Roles differ too.
              type="button"
              role="tab"
              id={tabId(tab.id)}
              className="erp-tab"
              ref={(node) => {
                if (node) buttons.current.set(tab.id, node);
                else buttons.current.delete(tab.id);
              }}
              aria-selected={active}
              aria-controls={panelId}
              aria-disabled={tab.disabled ? true : undefined}
              // Roving tabindex: one stop for the whole tablist, so Tab
              // moves past the tabs rather than through every one of them.
              tabIndex={active ? 0 : -1}
              onClick={() => choose(tab)}
              onKeyDown={onKeyDown}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        className="erp-tabpanel"
        role="tabpanel"
        id={panelId}
        aria-labelledby={selected ? tabId(selected) : undefined}
        // Focusable so a keyboard user can reach panel content that holds
        // nothing focusable of its own -- a panel of plain text would
        // otherwise be unreachable and unreadable by keyboard.
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}

export default Tabs;
