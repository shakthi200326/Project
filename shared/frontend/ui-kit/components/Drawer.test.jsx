import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import Drawer from "./Drawer";

describe("Drawer component", () => {
  it("does not render when open is false", () => {
    render(
      <Drawer open={false} title="Drawer Title" onClose={() => {}}>
        <p>Drawer content</p>
      </Drawer>
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a modal dialog when open is true", () => {
    render(
      <Drawer open={true} title="Edit Settings" subtitle="Configure platform variables" onClose={() => {}}>
        <p>Drawer content</p>
      </Drawer>
    );

    const dialog = screen.getByRole("dialog", { name: "Edit Settings" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Configure platform variables")).toBeInTheDocument();
    expect(screen.getByText("Drawer content")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Drawer open={true} title="Tenant Detail" onClose={onClose}>
        <p>Detail content</p>
      </Drawer>
    );

    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Drawer open={true} title="Tenant Detail" onClose={onClose}>
        <p>Detail content</p>
      </Drawer>
    );

    const backdrop = container.querySelector(".erp-drawer-backdrop");
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the drawer panel", () => {
    const onClose = vi.fn();
    render(
      <Drawer open={true} title="Tenant Detail" onClose={onClose}>
        <p>Inside panel content</p>
      </Drawer>
    );

    const content = screen.getByText("Inside panel content");
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders footer actions when provided", () => {
    render(
      <Drawer
        open={true}
        title="Form Drawer"
        onClose={() => {}}
        footer={<button type="button">Save Changes</button>}
      >
        <p>Form fields</p>
      </Drawer>
    );

    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });
});

