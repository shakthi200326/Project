/**
 * Dialog behaviour: the focus contract and the confirmation built on it.
 *
 * The focus tests are the regression-prone ones. A dialog that lets Tab
 * wander onto the page behind it, or that drops focus on close, is broken
 * only for people using a keyboard -- which is exactly the kind of breakage
 * that survives manual testing.
 */

import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import Button from "./Button";
import ConfirmDialog from "./ConfirmDialog";
import Modal from "./Modal";

function Form({ open, onClose }) {
  return (
    <Modal open={open} title="Edit unit" onClose={onClose} footer={<button type="button">Save</button>}>
      <input aria-label="Name" />
      <input aria-label="Code" />
    </Modal>
  );
}

describe("Modal accessibility", () => {
  it("is a labelled modal dialog", () => {
    render(<Form open onClose={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: "Edit unit" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("moves focus into the dialog when it opens", () => {
    render(<Form open onClose={() => {}} />);

    // The close button is the first focusable thing in the panel.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" })
    );
  });

  it("returns focus to whatever opened it", () => {
    function Screen() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Edit
          </button>
          <Form open={open} onClose={() => setOpen(false)} />
        </>
      );
    }

    render(<Screen />);
    const opener = screen.getByRole("button", { name: "Edit" });
    opener.focus();

    fireEvent.click(opener);
    expect(document.activeElement).not.toBe(opener);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(opener);
  });

  it("wraps Tab from the last control back to the first", () => {
    render(<Form open onClose={() => {}} />);

    const close = screen.getByRole("button", { name: "Close" });
    const save = screen.getByRole("button", { name: "Save" });

    save.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(close);
  });

  it("wraps Shift+Tab from the first control back to the last", () => {
    render(<Form open onClose={() => {}} />);

    const close = screen.getByRole("button", { name: "Close" });
    const save = screen.getByRole("button", { name: "Save" });

    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(save);
  });

  it("pulls focus back if it is outside the dialog", () => {
    render(<Form open onClose={() => {}} />);

    document.body.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("still closes on Escape", () => {
    const onClose = vi.fn();
    render(<Form open onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("still closes on a backdrop click and not on a panel click", () => {
    const onClose = vi.fn();
    const { container } = render(<Form open onClose={onClose} />);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector(".erp-modal-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders nothing while closed", () => {
    render(<Form open={false} onClose={() => {}} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Button danger variant", () => {
  it("carries the danger class", () => {
    render(<Button variant="danger">Deactivate</Button>);

    expect(screen.getByRole("button", { name: "Deactivate" })).toHaveClass(
      "erp-button-danger"
    );
  });

  it("leaves the default variant alone", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "erp-button-primary"
    );
  });

  it("still disables and still clicks", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button variant="danger" onClick={onClick}>
        Go
      </Button>
    );

    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <Button variant="danger" onClick={onClick} disabled>
        Go
      </Button>
    );
    expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
  });
});

describe("ConfirmDialog", () => {
  const setup = (props = {}) => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Deactivate unit"
        message="It cannot be chosen again until reactivated."
        confirmLabel="Deactivate"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />
    );

    return { onConfirm, onCancel };
  };

  it("asks the question", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "Deactivate unit" })).toBeInTheDocument();
    expect(
      screen.getByText("It cannot be chosen again until reactivated.")
    ).toBeInTheDocument();
  });

  it("confirms and cancels", () => {
    const { onConfirm, onCancel } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(onConfirm).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("uses the danger variant for the confirming action", () => {
    setup();

    expect(screen.getByRole("button", { name: "Deactivate" })).toHaveClass(
      "erp-button-danger"
    );
  });

  it("disables both actions while the request is running", () => {
    setup({ busy: true, busyLabel: "Deactivating..." });

    expect(screen.getByRole("button", { name: "Deactivating..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("cannot be dismissed while the request is running", () => {
    // Escape here would leave the screen disagreeing with the server.
    const { onCancel } = setup({ busy: true });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("renders nothing while closed", () => {
    render(
      <ConfirmDialog open={false} onConfirm={() => {}} onCancel={() => {}} />
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
