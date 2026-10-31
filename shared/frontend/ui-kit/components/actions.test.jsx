/**
 * Buttons and the menu they overflow into.
 *
 * `ActionMenu` gets most of the attention because a menu is one of the few
 * widgets with no HTML element behind it: everything a `<select>` or a
 * `<button>` would give for free -- keyboard movement, escape, focus going
 * somewhere sensible afterwards -- is code here, and code that is only
 * exercised by people who do not use a mouse. So it is tested by keyboard.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import ActionMenu from "./ActionMenu";
import Button from "./Button";
import IconButton from "./IconButton";

const ITEMS = [
  { id: "duplicate", label: "Duplicate", onSelect: () => {} },
  { id: "print", label: "Print", onSelect: () => {} },
  { id: "archive", label: "Archive", tone: "danger", onSelect: () => {} },
];

const openMenu = () => {
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  return screen.getByRole("menu");
};

describe("Button while busy", () => {
  it("says it is working rather than only spinning", () => {
    render(
      <Button loading loadingLabel="Saving...">
        Save
      </Button>
    );

    expect(screen.getByRole("button")).toHaveTextContent("Saving...");
  });

  it("cannot be pressed twice", () => {
    // Submitting twice is how one invoice becomes two.
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is marked busy, not merely unavailable", () => {
    render(<Button loading>Save</Button>);

    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("is not marked busy when it is simply disabled", () => {
    render(<Button disabled>Save</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("keeps its label when no busy wording is given", () => {
    render(<Button loading>Save</Button>);

    expect(screen.getByRole("button")).toHaveTextContent("Save");
  });

  it("carries a size", () => {
    render(<Button size="sm">Edit</Button>);

    expect(screen.getByRole("button")).toHaveClass("erp-button-sm");
  });
});

describe("IconButton", () => {
  it("is named by its label, not by its symbol", () => {
    render(
      <IconButton label="Remove line" onClick={() => {}}>
        &times;
      </IconButton>
    );

    expect(screen.getByRole("button", { name: "Remove line" })).toBeInTheDocument();
  });

  it("hides the symbol from screen readers", () => {
    // Announcing both would read the control out twice.
    const { container } = render(
      <IconButton label="Remove line">&times;</IconButton>
    );

    expect(container.querySelector("span")).toHaveAttribute("aria-hidden", "true");
  });

  it("clicks and disables", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <IconButton label="Remove line" onClick={onClick}>
        &times;
      </IconButton>
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove line" }));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <IconButton label="Remove line" onClick={onClick} disabled>
        &times;
      </IconButton>
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove line" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("ActionMenu structure", () => {
  it("renders nothing when there is nothing to offer", () => {
    const { container } = render(<ActionMenu items={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("starts closed", () => {
    render(<ActionMenu items={ITEMS} />);

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Actions" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("announces that it opens a menu", () => {
    render(<ActionMenu items={ITEMS} />);

    expect(screen.getByRole("button", { name: "Actions" })).toHaveAttribute(
      "aria-haspopup",
      "menu"
    );
  });

  it("opens on click, with its items as menu items", () => {
    render(<ActionMenu items={ITEMS} />);

    openMenu();

    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Actions" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("takes a label of its own", () => {
    render(<ActionMenu items={ITEMS} label="Customer actions" />);

    expect(
      screen.getByRole("button", { name: "Customer actions" })
    ).toBeInTheDocument();
  });

  it("does not open when the whole menu is unavailable", () => {
    render(<ActionMenu items={ITEMS} disabled />);

    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toBeDisabled();

    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("choosing an action", () => {
  it("runs it and closes", () => {
    const onSelect = vi.fn();
    render(
      <ActionMenu items={[{ id: "print", label: "Print", onSelect }]} />
    );

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Print" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ignores an item that is not available", () => {
    const onSelect = vi.fn();
    render(
      <ActionMenu
        items={[{ id: "print", label: "Print", onSelect, disabled: true }]}
      />
    );

    openMenu();
    const item = screen.getByRole("menuitem", { name: "Print" });
    expect(item).toBeDisabled();

    fireEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes when a click lands elsewhere on the page", () => {
    render(
      <>
        <ActionMenu items={ITEMS} />
        <button type="button">Somewhere else</button>
      </>
    );

    openMenu();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Somewhere else" }));

    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("ActionMenu by keyboard", () => {
  it("moves focus into the menu as it opens", () => {
    // A menu that opens behind the focus ring cannot be reached at all.
    render(<ActionMenu items={ITEMS} />);

    openMenu();

    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
  });

  it("opens on ArrowDown from the trigger", () => {
    render(<ActionMenu items={ITEMS} />);

    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
  });

  it("steps through items with the arrow keys", () => {
    render(<ActionMenu items={ITEMS} />);

    const menu = openMenu();

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Print" })).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
  });

  it("wraps around at each end", () => {
    render(<ActionMenu items={ITEMS} />);

    const menu = openMenu();

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(screen.getByRole("menuitem", { name: "Archive" })).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
  });

  it("jumps to the ends with Home and End", () => {
    render(<ActionMenu items={ITEMS} />);

    const menu = openMenu();

    fireEvent.keyDown(menu, { key: "End" });
    expect(screen.getByRole("menuitem", { name: "Archive" })).toHaveFocus();

    fireEvent.keyDown(menu, { key: "Home" });
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
  });

  it("steps over an item that cannot be chosen", () => {
    render(
      <ActionMenu
        items={[
          ITEMS[0],
          { ...ITEMS[1], disabled: true },
          ITEMS[2],
        ]}
      />
    );

    const menu = openMenu();
    fireEvent.keyDown(menu, { key: "ArrowDown" });

    expect(screen.getByRole("menuitem", { name: "Archive" })).toHaveFocus();
  });

  it("closes on Escape and puts focus back on the trigger", () => {
    render(<ActionMenu items={ITEMS} />);

    const menu = openMenu();
    fireEvent.keyDown(menu, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus();
  });

  it("closes on Tab rather than being left open behind the page", () => {
    render(<ActionMenu items={ITEMS} />);

    const menu = openMenu();
    fireEvent.keyDown(menu, { key: "Tab" });

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps the items out of the tab order", () => {
    // One stop for the menu, not one per item.
    render(<ActionMenu items={ITEMS} />);

    openMenu();

    screen
      .getAllByRole("menuitem")
      .forEach((item) => expect(item).toHaveAttribute("tabindex", "-1"));
  });
});
