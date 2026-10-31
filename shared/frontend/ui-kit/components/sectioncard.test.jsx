/**
 * The titled panel and its four ways of having nothing to show.
 *
 * The states are what this component exists for. A panel that could only
 * render content is a panel whose screen has to handle every other case
 * around it — and a dashboard of eight widgets would carry eight copies of
 * that handling, which is how six of them end up handling it differently.
 *
 * The distinction worth testing hardest is **unavailable is not an error**.
 * "Your organization does not use Sales" and "the request failed" are
 * different facts, and a person who cannot act on the first should not be
 * shown alarm colours for it.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import SectionCard from "./SectionCard";

const failure = (code, message) => ({ code, message });

describe("SectionCard", () => {
  it("names itself with a heading", () => {
    render(<SectionCard title="Revenue trend">body</SectionCard>);

    expect(
      screen.getByRole("heading", { level: 2, name: "Revenue trend" })
    ).toBeInTheDocument();
  });

  it("leaves the page's only h1 to PageHeader", () => {
    render(<SectionCard title="Revenue trend">body</SectionCard>);

    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("takes a heading level for a panel nested deeper", () => {
    render(
      <SectionCard title="Roles" headingLevel={3}>
        body
      </SectionCard>
    );

    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("carries a description and an action", () => {
    render(
      <SectionCard
        title="Companies"
        description="The legal entities you operate as"
        action={<button type="button">New company</button>}
      >
        body
      </SectionCard>
    );

    expect(
      screen.getByText("The legal entities you operate as")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New company" })).toBeInTheDocument();
  });

  it("draws its children when there is nothing else to say", () => {
    render(<SectionCard title="Revenue">the chart</SectionCard>);

    expect(screen.getByText("the chart")).toBeInTheDocument();
  });
});

describe("its states", () => {
  it("keeps the heading while loading, so the page does not jump", () => {
    render(
      <SectionCard title="Revenue" loading>
        the chart
      </SectionCard>
    );

    expect(screen.getByRole("heading", { name: "Revenue" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("the chart")).toBeNull();
  });

  it("draws a failure inside the panel, so one widget fails alone", () => {
    render(
      <SectionCard title="Revenue" error={failure("INTERNAL_ERROR", "boom")}>
        the chart
      </SectionCard>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revenue" })).toBeInTheDocument();
    expect(screen.queryByText("the chart")).toBeNull();
  });

  it("offers a retry when the caller supplies one", () => {
    const retry = vi.fn();
    render(
      <SectionCard title="Revenue" error={failure("ERROR", "boom")} onRetry={retry}>
        body
      </SectionCard>
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalled();
  });

  it("draws an empty state rather than a blank card", () => {
    render(
      <SectionCard
        title="Recent orders"
        empty
        emptyTitle="No orders yet"
        emptyDescription="Sales orders will appear here."
      >
        the table
      </SectionCard>
    );

    expect(screen.getByText("No orders yet")).toBeInTheDocument();
    expect(screen.queryByText("the table")).toBeNull();
  });

  it("says why a widget is unavailable, without calling it an error", () => {
    render(
      <SectionCard title="Recent orders" unavailable="This organization does not use Sales.">
        the table
      </SectionCard>
    );

    expect(
      screen.getByText("This organization does not use Sales.")
    ).toBeInTheDocument();
    // Not an alert: there is nothing here to act on or be alarmed by.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("the table")).toBeNull();
  });
});

describe("the order it resolves them in", () => {
  // A caller can pass several without deciding a precedence: the most
  // specific reason the panel has nothing to show is the one drawn.

  it("prefers unavailable over an error", () => {
    render(
      <SectionCard
        title="Orders"
        unavailable="Sales is not in use."
        error={failure("ERROR", "boom")}
      >
        body
      </SectionCard>
    );

    expect(screen.getByText("Sales is not in use.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("prefers an error over loading", () => {
    render(
      <SectionCard title="Orders" error={failure("ERROR", "boom")} loading>
        body
      </SectionCard>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("prefers loading over empty", () => {
    render(
      <SectionCard title="Orders" loading empty emptyTitle="Nothing yet">
        body
      </SectionCard>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Nothing yet")).toBeNull();
  });
});
