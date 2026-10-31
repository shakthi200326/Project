/**
 * The actions that do not fit on the screen, behind one control.
 *
 * Every ERP record grows more actions than a header has room for --
 * Duplicate, Print, Export, Archive, Change owner -- and every table row
 * grows the same list. Without somewhere to put them they end up as a row
 * of six buttons, or as a `<select>` pretending to be a menu, which is the
 * worse of the two because it announces itself as a choice being made
 * rather than a command being issued.
 *
 *     <ActionMenu label="Customer actions" items={[
 *       { id: "duplicate", label: "Duplicate", onSelect: duplicate },
 *       { id: "archive", label: "Archive", tone: "danger", onSelect: archive },
 *     ]} />
 *
 * A menu is one of the few widgets with no HTML element behind it, so the
 * keyboard contract has to be built: arrows move between items, Home and
 * End jump, Escape closes and puts focus back on the trigger, and Tab
 * closes rather than walking into the page with a menu still open. Focus
 * moves into the menu when it opens, which is what makes it reachable at
 * all without a mouse.
 *
 * It decides nothing about permissions and nothing about context. An item
 * that is not available right now is passed `disabled` by the caller, for
 * the same reason `ListView` does not consult permissions either: the
 * server owns the answer.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

function ActionMenu({
  items = [],
  label = "Actions",
  trigger = "⋯",
  align = "end",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);

  const wrapper = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef(new Map());

  const menuId = useId();

  // A disabled item is not somewhere focus may land, so the arrow keys
  // step over it rather than stopping on something that does nothing.
  const available = items.filter((item) => !item.disabled);

  const focusItem = useCallback((id) => {
    const node = itemRefs.current.get(id);
    if (node) node.focus();
  }, []);

  const close = useCallback(
    ({ restoreFocus = true } = {}) => {
      setOpen(false);
      // Back to the trigger, so the keyboard ends up where the user left
      // it rather than at the top of the document.
      if (restoreFocus && triggerRef.current) triggerRef.current.focus();
    },
    []
  );

  // Focus the first item as the menu opens: a menu that opens behind the
  // focus ring is a menu a keyboard user cannot reach.
  useEffect(() => {
    if (!open) return;
    const first = available[0];
    if (first) focusItem(first.id);
  }, [open, available, focusItem]);

  // A click anywhere else closes it -- without restoring focus, because
  // the user has already put focus somewhere of their own choosing.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const choose = useCallback(
    (item) => {
      if (item.disabled) return;
      // Closed before the action runs: an action that opens a dialog would
      // otherwise leave the menu sitting over it. Focus is not restored,
      // because whatever the action opens should get it.
      setOpen(false);
      if (item.onSelect) item.onSelect();
    },
    []
  );

  const onMenuKeyDown = useCallback(
    (event) => {
      if (available.length === 0) return;

      const at = available.findIndex(
        (item) => itemRefs.current.get(item.id) === document.activeElement
      );

      const step = (delta) => {
        const next = (at + delta + available.length) % available.length;
        focusItem(available[next].id);
      };

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          step(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          step(-1);
          break;
        case "Home":
          event.preventDefault();
          focusItem(available[0].id);
          break;
        case "End":
          event.preventDefault();
          focusItem(available[available.length - 1].id);
          break;
        case "Escape":
          event.preventDefault();
          close();
          break;
        case "Tab":
          // Not prevented: Tab should move on. The menu just must not be
          // left open behind it.
          close({ restoreFocus: false });
          break;
        default:
          break;
      }
    },
    [available, close, focusItem]
  );

  const onTriggerKeyDown = useCallback(
    (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
      }
    },
    []
  );

  if (items.length === 0) return null;

  return (
    <div className="erp-action-menu" ref={wrapper}>
      <button
        type="button"
        ref={triggerRef}
        className="erp-icon-button erp-icon-button-ghost"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={onTriggerKeyDown}
      >
        <span aria-hidden="true">{trigger}</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`erp-menu erp-menu-${align}`}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`erp-menu-item${
                item.tone ? ` erp-menu-item-${item.tone}` : ""
              }`}
              ref={(node) => {
                if (node) itemRefs.current.set(item.id, node);
                else itemRefs.current.delete(item.id);
              }}
              disabled={item.disabled}
              // Roving tabindex: Tab leaves the menu rather than walking
              // through every item in it.
              tabIndex={-1}
              onClick={() => choose(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ActionMenu;
