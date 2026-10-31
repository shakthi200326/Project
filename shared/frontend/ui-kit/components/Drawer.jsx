/**
 * A slide-over drawer panel for detail views, quick edits, and creation wizards.
 *
 * Keeps the underlying list or workspace visible while providing a dedicated,
 * accessible surface with a focus trap, Escape-to-dismiss, backdrop click to dismiss,
 * and flexible action footer.
 */

import { useEffect, useId, useRef } from "react";
import { useFocusTrap } from "../focusTrap";
import Icon from "./Icon";

export default function Drawer({
  open,
  title,
  subtitle = null,
  onClose,
  children,
  footer = null,
  width = 560,
  accent = null,
  className = "",
}) {
  const panel = useRef(null);
  const titleId = useId();

  useFocusTrap({ open, onClose, panel });

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const widthStyle = typeof width === "number" ? `${width}px` : width;

  return (
    <div className="erp-drawer-backdrop" onClick={onClose}>
      <aside
        ref={panel}
        className={`erp-drawer ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          "--erp-drawer-width": widthStyle,
          ...(accent ? { "--erp-color-primary": accent } : {}),
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="erp-drawer-head">
          <div className="erp-drawer-titles">
            <h2 id={titleId} className="erp-drawer-title">
              {title}
            </h2>
            {subtitle && <p className="erp-drawer-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="erp-drawer-close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="erp-drawer-body">{children}</div>

        {footer && <footer className="erp-drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

