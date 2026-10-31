/**
 * The page shell: container, heading block, actions and breadcrumbs.
 *
 * These are layout components, so the tests are about structure and
 * semantics -- heading level, current-page marking, what is rendered at all
 * -- rather than about pixels.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import Breadcrumbs from "./Breadcrumbs";
import Page from "./Page";
import PageActions from "./PageActions";
import PageHeader from "./PageHeader";

describe("Page", () => {
  it("renders what it is given", () => {
    render(
      <Page>
        <p>Content</p>
      </Page>
    );

    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders the title as the page's first-level heading", () => {
    render(<PageHeader title="Units of Measure" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Units of Measure" })
    ).toBeInTheDocument();
  });

  it("shows a description when there is one", () => {
    render(<PageHeader title="Units" description="Units quantities use." />);

    expect(screen.getByText("Units quantities use.")).toBeInTheDocument();
  });

  it("omits the description entirely when there is none", () => {
    const { container } = render(<PageHeader title="Units" />);

    expect(container.querySelector(".erp-page-description")).toBeNull();
  });

  it("renders breadcrumbs and actions in their slots", () => {
    render(
      <PageHeader
        title="Units"
        breadcrumbs={<Breadcrumbs items={[{ label: "Master Data", to: "/md" }, { label: "Units" }]} />}
        actions={<button type="button">New unit</button>}
      />
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New unit" })).toBeInTheDocument();
  });
});

describe("PageActions", () => {
  it("groups the actions it is given", () => {
    render(
      <PageActions>
        <button type="button">New</button>
        <button type="button">Export</button>
      </PageActions>
    );

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("renders nothing when there is nothing to show", () => {
    // A read-only screen passes no actions; it should not get an empty row
    // pushing its content down.
    const { container } = render(<PageActions>{false}</PageActions>);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for an array of nothing", () => {
    const { container } = render(<PageActions>{[false, null]}</PageActions>);

    expect(container.firstChild).toBeNull();
  });
});

describe("Breadcrumbs", () => {
  const TRAIL = [
    { label: "Home", to: "/" },
    { label: "Master Data", to: "/master-data" },
    { label: "Units of Measure" },
  ];

  it("renders nothing without items", () => {
    const { container } = render(<Breadcrumbs items={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("links every crumb except the current page", () => {
    render(<Breadcrumbs items={TRAIL} />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Master Data" })).toBeInTheDocument();
    // Never a link to where the user already is.
    expect(screen.queryByRole("link", { name: "Units of Measure" })).toBeNull();
  });

  it("marks the last crumb as the current page", () => {
    render(<Breadcrumbs items={TRAIL} />);

    expect(screen.getByText("Units of Measure")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("uses a caller's link component when given one", () => {
    // How a router-aware caller avoids a full page reload.
    const Link = vi.fn(({ to, children }) => <a href={to} data-router="yes">{children}</a>);

    render(<Breadcrumbs items={TRAIL} linkComponent={Link} />);

    expect(Link).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "data-router",
      "yes"
    );
  });

  it("is a labelled navigation landmark", () => {
    render(<Breadcrumbs items={TRAIL} />);

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("does not link a crumb with no destination", () => {
    render(<Breadcrumbs items={[{ label: "Standalone" }, { label: "Here" }]} />);

    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("PageHeader actions are the caller's business", () => {
  it("does not interfere with an action's own handler", () => {
    const onClick = vi.fn();

    render(
      <PageHeader
        title="Units"
        actions={
          <PageActions>
            <button type="button" onClick={onClick}>
              New unit
            </button>
          </PageActions>
        }
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New unit" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
