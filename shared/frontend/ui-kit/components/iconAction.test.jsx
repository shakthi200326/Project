/**
 * The icon actions every list uses, and the password field's eye.
 *
 * The name is the part worth pinning down: an icon on its own announces
 * nothing, so every action must carry its label as its accessible name.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import IconAction, { RowActions } from "./IconAction";
import Input from "./Input";
import { LinkComponentProvider } from "../linking";

function RouterLink({ to, children, ...rest }) {
  return (
    <a href={to} data-router-link="" {...rest}>
      {children}
    </a>
  );
}

describe("IconAction", () => {
  it("is a button named by its label, with the label as its tooltip", () => {
    const onClick = vi.fn();
    render(<IconAction icon="edit" label="Edit Acme" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Edit Acme" });
    expect(button).toHaveAttribute("title", "Edit Acme");
    expect(button.querySelector("svg")).not.toBeNull();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is a router link when given somewhere to go", () => {
    render(
      <LinkComponentProvider value={RouterLink}>
        <IconAction icon="manage" label="Manage" to="/administration/people/4/edit" />
      </LinkComponentProvider>
    );

    const link = screen.getByRole("link", { name: "Manage" });
    expect(link).toHaveAttribute("data-router-link");
    expect(link).toHaveAttribute("href", "/administration/people/4/edit");
  });

  it("marks a destructive action so it can say so on hover", () => {
    render(<IconAction icon="delete" tone="danger" label="Delete" onClick={() => {}} />);

    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("erp-icon-action-danger");
  });

  it("does not let a row that opens on click open as well", () => {
    const onRow = vi.fn();
    const onAction = vi.fn();
    render(
      <div onClick={onRow}>
        <RowActions>
          <IconAction icon="view" label="View" onClick={onAction} />
        </RowActions>
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
  });
});

describe("a password field", () => {
  it("shows and hides what was typed, and says which it is doing", () => {
    render(<Input label="Password" type="password" value="s3cret" onChange={() => {}} />);

    const field = screen.getByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");

    const reveal = screen.getByRole("button", { name: "Show password" });
    expect(reveal).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(reveal);
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });

  it("leaves every other kind of field without one", () => {
    render(<Input label="Email" type="email" value="" onChange={() => {}} />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
