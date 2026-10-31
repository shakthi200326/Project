/**
 * "Are you sure?", built on the dialog we already have.
 *
 * Composes `Modal` rather than reimplementing one, so Escape, the backdrop,
 * the focus trap and focus restoration are the same here as in every form.
 *
 * `busy` is the state between clicking Confirm and the server answering.
 * Both buttons go disabled: confirming twice is how a deactivate becomes
 * two requests, and cancelling a request already in flight only makes the
 * screen disagree with the server.
 */
import Button from "./Button";
import Modal from "./Modal";

function ConfirmDialog({
  open,
  title = "Are you sure?",
  message = null,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busyLabel = "Working...",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
  children = null,
}) {
  return (
    <Modal
      open={open}
      title={title}
      // While the action is running the dialog stays put: Escape and the
      // backdrop would otherwise close it out from under the request.
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p className="erp-confirm-message">{message}</p>}
      {children}
    </Modal>
  );
}

export default ConfirmDialog;
