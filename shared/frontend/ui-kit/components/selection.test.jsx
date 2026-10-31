/**
 * Choosing a record by typing, and explaining a control.
 *
 * `SearchSelect` is the more demanding of the two. A combobox is one of the
 * few widgets with no HTML element behind it, so everything a `<select>`
 * gives free — keyboard movement, what the screen reader is told, what
 * happens when nothing matches — is code, and code only exercised by people
 * who do not use a mouse. It is tested by keyboard first.
 *
 * The rule it most has to keep: **arrowing is not choosing.** Moving
 * through a list of customers must not select one on the way past, or the
 * field quietly changes under a typist who was only looking.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import SearchSelect from "./SearchSelect";
import Tooltip from "./Tooltip";

const OPTIONS = [
  { value: 1, label: "1 Industrial Estate", description: "Bengaluru" },
  { value: 2, label: "2 Harbour Road", description: "Chennai" },
  { value: 3, label: "3 Mill Lane", description: "Pune" },
];

const renderSelect = (props = {}) => {
  const onChange = vi.fn();
  const onSearch = vi.fn();

  const result = render(
    <SearchSelect
      label="Address"
      value={null}
      options={OPTIONS}
      onChange={onChange}
      onSearch={onSearch}
      {...props}
    />
  );

  return { ...result, onChange, onSearch };
};

const input = () => screen.getByRole("combobox", { name: /Address/ });

const openList = () => {
  // Real focus, not just a focus event: the activedescendant test asserts
  // that focus never leaves the input, which only means something if it
  // was actually there.
  input().focus();
  fireEvent.focus(input());
  return screen.getByRole("listbox");
};

describe("SearchSelect structure", () => {
  it("is a labelled combobox", () => {
    renderSelect();

    expect(input()).toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-autocomplete", "list");
  });

  it("starts closed", () => {
    renderSelect();

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on focus and says so", () => {
    renderSelect();
    openList();

    expect(input()).toHaveAttribute("aria-expanded", "true");
  });

  it("offers each option, with its second line", () => {
    renderSelect();
    const list = openList();

    expect(within(list).getAllByRole("option")).toHaveLength(3);
    expect(within(list).getByText("Bengaluru")).toBeInTheDocument();
  });

  it("carries its error to the control", () => {
    renderSelect({ error: "Choose an address." });

    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toHaveAccessibleDescription("Choose an address.");
  });

  it("disables", () => {
    renderSelect({ disabled: true });

    expect(input()).toBeDisabled();
  });
});

describe("SearchSelect typing", () => {
  it("reports what was typed rather than filtering itself", () => {
    // The caller owns the query; this control owns no request and no timer.
    const { onSearch } = renderSelect();

    fireEvent.change(input(), { target: { value: "harbour" } });

    expect(onSearch).toHaveBeenCalledWith("harbour");
  });

  it("says it is searching, out loud", () => {
    renderSelect({ loading: true });
    openList();

    expect(screen.getByText("Searching")).toHaveClass("erp-visually-hidden");
  });

  it("says when a term matches nothing", () => {
    renderSelect({ options: [] });

    fireEvent.change(input(), { target: { value: "zzz" } });

    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("prompts before anything is typed", () => {
    // An empty list with no term is not "no matches" — nothing was asked.
    renderSelect({ options: [] });
    openList();

    expect(screen.getByText("Type to search")).toBeInTheDocument();
  });

  it("does not announce the prompt as something choosable", () => {
    renderSelect({ options: [] });
    openList();

    expect(screen.queryByRole("option")).toBeNull();
  });
});

describe("SearchSelect by keyboard", () => {
  it("moves through the options without choosing one", () => {
    // The rule that matters: arrowing past a customer must not select it.
    const { onChange } = renderSelect();
    openList();

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("tells the screen reader where the keyboard is", () => {
    // Focus stays in the input; aria-activedescendant is what moves.
    renderSelect();
    openList();

    const first = input().getAttribute("aria-activedescendant");
    fireEvent.keyDown(input(), { key: "ArrowDown" });

    expect(input().getAttribute("aria-activedescendant")).not.toBe(first);
    expect(input()).toHaveFocus();
  });

  it("chooses the active option on Enter", () => {
    const { onChange } = renderSelect();
    openList();

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(OPTIONS[1]);
  });

  it("wraps around at the end of the list", () => {
    const { onChange } = renderSelect();
    openList();

    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(OPTIONS[2]);
  });

  it("opens on ArrowDown when closed, without choosing", () => {
    const { onChange } = renderSelect();

    fireEvent.keyDown(input(), { key: "ArrowDown" });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leaves Enter alone while the list is closed", () => {
    // Enter in a closed combobox belongs to the form around it.
    const { onChange } = renderSelect();

    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    renderSelect();
    openList();

    fireEvent.keyDown(input(), { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("clears the term only on a second Escape", () => {
    // So Escape is never a surprise deletion of what was typed.
    const { onSearch } = renderSelect();

    fireEvent.change(input(), { target: { value: "harbour" } });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input()).toHaveValue("harbour");

    fireEvent.keyDown(input(), { key: "Escape" });
    expect(onSearch).toHaveBeenLastCalledWith("");
  });
});

describe("SearchSelect once something is chosen", () => {
  const chosen = OPTIONS[0];

  it("shows what it holds", () => {
    renderSelect({ value: chosen });

    expect(input()).toHaveValue("1 Industrial Estate");
  });

  it("marks the chosen option as selected", () => {
    renderSelect({ value: chosen });
    const list = openList();

    expect(
      within(list).getByRole("option", { name: /1 Industrial Estate/ })
    ).toHaveAttribute("aria-selected", "true");
  });

  it("offers a named way to clear it", () => {
    const { onChange } = renderSelect({ value: chosen });

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("offers no clear control when nothing is chosen", () => {
    renderSelect();

    expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();
  });

  it("chooses on pointer down, before the input can blur", () => {
    // A click would close the list out from under the pointer first.
    const { onChange } = renderSelect();
    const list = openList();

    fireEvent.mouseDown(within(list).getAllByRole("option")[2]);

    expect(onChange).toHaveBeenCalledWith(OPTIONS[2]);
  });

  it("closes and drops the term after choosing", () => {
    const { onSearch } = renderSelect();
    const list = openList();

    fireEvent.mouseDown(within(list).getAllByRole("option")[0]);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onSearch).toHaveBeenLastCalledWith("");
  });

  it("closes when a click lands elsewhere", () => {
    render(<button type="button">Somewhere else</button>);
    renderSelect();
    openList();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Somewhere else" }));

    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Tooltip", () => {
  const renderTooltip = (props = {}) =>
    render(
      <Tooltip text="Reverses the posting" {...props}>
        <button type="button">Reverse</button>
      </Tooltip>
    );

  const trigger = () => screen.getByRole("button", { name: "Reverse" });

  it("stays out of the way until it is wanted", () => {
    renderTooltip();

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows on hover", () => {
    renderTooltip();

    fireEvent.mouseEnter(trigger());

    expect(screen.getByRole("tooltip")).toHaveTextContent("Reverses the posting");
  });

  it("shows on focus, for a keyboard that never hovers", () => {
    renderTooltip();

    fireEvent.focus(trigger());

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("describes the control rather than naming it", () => {
    // A tooltip is extra detail about a control that already has a name.
    renderTooltip();

    fireEvent.focus(trigger());

    expect(trigger()).toHaveAccessibleName("Reverse");
    expect(trigger()).toHaveAccessibleDescription("Reverses the posting");
  });

  it("hides again on blur", () => {
    renderTooltip();

    fireEvent.focus(trigger());
    fireEvent.blur(trigger());

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("hides on mouse leave", () => {
    renderTooltip();

    fireEvent.mouseEnter(trigger());
    fireEvent.mouseLeave(trigger());

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("can be dismissed with Escape while the trigger keeps focus", () => {
    renderTooltip();

    fireEvent.focus(trigger());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("stops listening for Escape once it is hidden", () => {
    // A document listener outliving the tooltip would swallow Escape for
    // whatever else wanted it — an open dialog, most obviously.
    const { unmount } = renderTooltip();
    const before = document.addEventListener;

    unmount();
    expect(document.addEventListener).toBe(before);
  });

  it("attaches nothing when there is nothing to say", () => {
    render(
      <Tooltip text="">
        <button type="button">Plain</button>
      </Tooltip>
    );

    fireEvent.focus(screen.getByRole("button", { name: "Plain" }));

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("button", { name: "Plain" })).not.toHaveAttribute(
      "aria-describedby"
    );
  });
});
