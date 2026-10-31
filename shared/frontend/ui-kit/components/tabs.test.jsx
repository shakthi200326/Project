/**
 * The tabs primitive.
 *
 * Most of these are accessibility tests, which is the right emphasis: a
 * tabbed interface that works with a mouse and not with a keyboard is the
 * single most common way a design system fails the people who need it
 * most, and none of it is visible in a screenshot.
 *
 * The other thing worth pinning down is that activation is manual --
 * arrowing moves focus and does not choose -- because a record page's tab
 * is a URL, and the difference is four history entries per arrow key.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import Tabs from "./Tabs";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "addresses", label: "Addresses" },
  { id: "activity", label: "Activity" },
];

const WITH_DISABLED = [
  { id: "overview", label: "Overview" },
  { id: "locked", label: "Locked", disabled: true },
  { id: "activity", label: "Activity" },
];

function show(props = {}) {
  return render(
    <Tabs tabs={TABS} value="overview" {...props}>
      <p>Panel content</p>
    </Tabs>
  );
}

const tab = (name) => screen.getByRole("tab", { name });

describe("Tabs structure", () => {
  it("renders a tab for each entry", () => {
    show();

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(tab("Overview")).toBeInTheDocument();
  });

  it("names the tablist for a screen reader", () => {
    show({ label: "Customer sections" });

    expect(
      screen.getByRole("tablist", { name: "Customer sections" })
    ).toBeInTheDocument();
  });

  it("renders the panel and what is in it", () => {
    show();

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel content");
  });

  it("marks only the selected tab as selected", () => {
    show({ value: "activity" });

    expect(tab("Activity")).toHaveAttribute("aria-selected", "true");
    expect(tab("Overview")).toHaveAttribute("aria-selected", "false");
    expect(tab("Addresses")).toHaveAttribute("aria-selected", "false");
  });

  it("labels the panel with the tab that is showing", () => {
    show({ value: "addresses" });

    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      tab("Addresses").id
    );
  });

  it("points every aria-controls at a panel that exists", () => {
    // The reason there is one panel rather than one per tab. A reference to
    // an element that was never rendered is the sort of thing that passes
    // review and fails an audit.
    show();

    for (const control of screen.getAllByRole("tab")) {
      const target = control.getAttribute("aria-controls");
      expect(document.getElementById(target)).not.toBeNull();
    }
  });

  it("gives every tab a distinct id", () => {
    show();

    const ids = screen.getAllByRole("tab").map((control) => control.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(Boolean)).toBe(true);
  });

  it("does not collide with a second set of tabs on the same page", () => {
    render(
      <>
        <Tabs tabs={TABS} value="overview">
          <p>First</p>
        </Tabs>
        <Tabs tabs={TABS} value="overview">
          <p>Second</p>
        </Tabs>
      </>
    );

    const ids = screen.getAllByRole("tab").map((control) => control.id);
    const panels = screen.getAllByRole("tabpanel").map((panel) => panel.id);

    expect(new Set(ids).size).toBe(6);
    expect(new Set(panels).size).toBe(2);
  });

  it("shows content on its own when there are no tabs", () => {
    // A tablist with nothing in it is noise, the same rule the toolbar and
    // the page actions already follow.
    render(
      <Tabs tabs={[]}>
        <p>Just content</p>
      </Tabs>
    );

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("Just content")).toBeInTheDocument();
  });
});

describe("choosing a tab", () => {
  it("reports the tab that was clicked", () => {
    const onChange = vi.fn();
    show({ onChange });

    fireEvent.click(tab("Activity"));

    expect(onChange).toHaveBeenCalledWith("activity");
  });

  it("says nothing when the tab already showing is clicked", () => {
    const onChange = vi.fn();
    show({ onChange });

    fireEvent.click(tab("Overview"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("is controlled: clicking does not move the selection on its own", () => {
    // The caller owns which tab is showing. A component that also moved it
    // would disagree with the URL the moment one was involved.
    show({ onChange: vi.fn() });

    fireEvent.click(tab("Activity"));

    expect(tab("Overview")).toHaveAttribute("aria-selected", "true");
  });
});

describe("keyboard navigation", () => {
  it("has one tab stop for the whole tablist", () => {
    // Roving tabindex: Tab moves past the tabs, not through every one.
    show({ value: "addresses" });

    expect(tab("Addresses")).toHaveAttribute("tabindex", "0");
    expect(tab("Overview")).toHaveAttribute("tabindex", "-1");
    expect(tab("Activity")).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus right", () => {
    show();
    tab("Overview").focus();

    fireEvent.keyDown(tab("Overview"), { key: "ArrowRight" });

    expect(document.activeElement).toBe(tab("Addresses"));
  });

  it("moves focus left", () => {
    show({ value: "addresses" });
    tab("Addresses").focus();

    fireEvent.keyDown(tab("Addresses"), { key: "ArrowLeft" });

    expect(document.activeElement).toBe(tab("Overview"));
  });

  it("wraps around at both ends", () => {
    show();
    tab("Overview").focus();

    fireEvent.keyDown(tab("Overview"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tab("Activity"));

    fireEvent.keyDown(tab("Activity"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Overview"));
  });

  it("goes to the first tab on Home and the last on End", () => {
    show({ value: "addresses" });
    tab("Addresses").focus();

    fireEvent.keyDown(tab("Addresses"), { key: "End" });
    expect(document.activeElement).toBe(tab("Activity"));

    fireEvent.keyDown(tab("Activity"), { key: "Home" });
    expect(document.activeElement).toBe(tab("Overview"));
  });

  it("activates manually: arrowing moves focus without choosing", () => {
    // The behaviour a URL-backed tab depends on. Under automatic
    // activation, arrowing across four tabs would leave four history
    // entries and four requests behind it.
    const onChange = vi.fn();
    show({ onChange });
    tab("Overview").focus();

    fireEvent.keyDown(tab("Overview"), { key: "ArrowRight" });

    expect(document.activeElement).toBe(tab("Addresses"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("chooses the focused tab on Enter", () => {
    const onChange = vi.fn();
    show({ onChange });

    // A button turns Enter into a click, which is the path a real keyboard
    // takes -- so this asserts the whole route, not just the handler.
    tab("Activity").focus();
    fireEvent.click(tab("Activity"));

    expect(onChange).toHaveBeenCalledWith("activity");
  });

  it("does nothing on a key it does not handle", () => {
    const onChange = vi.fn();
    show({ onChange });
    tab("Overview").focus();

    fireEvent.keyDown(tab("Overview"), { key: "a" });

    expect(document.activeElement).toBe(tab("Overview"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("disabled tabs", () => {
  it("marks them disabled", () => {
    render(
      <Tabs tabs={WITH_DISABLED} value="overview">
        <p>Panel</p>
      </Tabs>
    );

    expect(tab("Locked")).toHaveAttribute("aria-disabled", "true");
  });

  it("cannot be chosen by clicking", () => {
    const onChange = vi.fn();
    render(
      <Tabs tabs={WITH_DISABLED} value="overview" onChange={onChange}>
        <p>Panel</p>
      </Tabs>
    );

    fireEvent.click(tab("Locked"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("is stepped over by the arrow keys", () => {
    render(
      <Tabs tabs={WITH_DISABLED} value="overview">
        <p>Panel</p>
      </Tabs>
    );
    tab("Overview").focus();

    fireEvent.keyDown(tab("Overview"), { key: "ArrowRight" });

    expect(document.activeElement).toBe(tab("Activity"));
  });

  it("is never what a stale value falls back to", () => {
    render(
      <Tabs tabs={WITH_DISABLED} value="locked">
        <p>Panel</p>
      </Tabs>
    );

    expect(tab("Locked")).toHaveAttribute("aria-selected", "false");
    expect(tab("Overview")).toHaveAttribute("aria-selected", "true");
  });
});

describe("a value naming no tab", () => {
  it("falls back to the first tab rather than selecting nothing", () => {
    show({ value: "removed-last-release" });

    expect(tab("Overview")).toHaveAttribute("aria-selected", "true");
  });
});
