import { useId, useRef } from "react";

import { useFocusTrap } from "../focusTrap";
import Icon from "./Icon";

/**
 * A dialog for the create and edit forms.
 *
 * Escape closes it and the backdrop closes it, because a form the user
 * cannot back out of is a trap. A click inside the panel is stopped from
 * reaching the backdrop, or selecting text would dismiss the form.
 *
 * Focus is the other half of "cannot back out of". While this is open, Tab
 * stays inside it -- otherwise the next Tab lands on the page behind, which
 * a sighted mouse user never notices and a keyboard user cannot recover
 * from. On close, focus returns to whatever opened it, so the keyboard ends
 * up where the user left it rather than at the top of the document.
 */

function Modal({ open, title, onClose, children, footer = null }) {
  const panel = useRef(null);
  const titleId = useId();

  useFocusTrap({ open, onClose, panel });

  if (!open) return null;

  return (
    <div className="erp-modal-backdrop" onClick={onClose}>
      <div
        ref={panel}
        className="erp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="erp-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="erp-modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>

        <div className="erp-modal-body">{children}</div>

        {footer && <div className="erp-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
