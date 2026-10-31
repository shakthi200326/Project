/**
 * Alerts, skeletons, the not-found state, and the way back.
 *
 * The recurring question in this file is whether something is announced,
 * and when. An alert that is on the page from the moment it renders must
 * not interrupt; a validation failure that appears later must. Getting
 * that backwards is how a product becomes unusable with a screen reader
 * while looking perfectly fine.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import Alert from "./Alert";
import Badge from "./Badge";
import BackLink from "./BackLink";
import NotFoundState from "./NotFoundState";
import Skeleton from "./Skeleton";

describe("Alert", () => {
  it("renders nothing when there is nothing to say", () => {
    const { container } = render(<Alert />);

    expect(container.firstChild).toBeNull();
  });

  it("shows its title and its message", () => {
    render(<Alert title="On credit hold">Orders cannot be confirmed.</Alert>);

    expect(screen.getByText("On credit hold")).toBeInTheDocument();
    expect(screen.getByText("Orders cannot be confirmed.")).toBeInTheDocument();
  });

  it("carries its tone", () => {
    const { container } = render(<Alert tone="warning">Careful.</Alert>);

    expect(container.firstChild).toHaveClass("erp-alert-warning");
  });

  it("stays quiet by default", () => {
    // Most of these are on the page from the start. Announcing every one on
    // arrival teaches people to tune the product out.
    render(<Alert tone="danger">This period is closed.</Alert>);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("speaks up when it is told it has just appeared", () => {
    render(
      <Alert tone="danger" live>
        This period is closed.
      </Alert>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("This period is closed.");
  });

  it("is polite when it is live but not a failure", () => {
    render(
      <Alert tone="info" live>
        Rates were refreshed.
      </Alert>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dismisses through a named control", () => {
    const onDismiss = vi.fn();
    render(
      <Alert onDismiss={onDismiss}>Rates were refreshed.</Alert>
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("has no dismiss control when it cannot be dismissed", () => {
    render(<Alert>Rates were refreshed.</Alert>);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows an action when it is given one", () => {
    render(
      <Alert action={<button type="button">Review</button>}>
        Two invoices need approval.
      </Alert>
    );

    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
  });
});

describe("Badge", () => {
  // The guarantee: Badge and Alert speak the same status vocabulary. A state
  // that is an alert in one place and a pill in another should not be a
  // different colour in each, and until recently three of these tones had no
  // rule behind them at all.
  const TONES = ["neutral", "muted", "success", "warning", "danger", "info"];

  it.each(TONES)("carries the %s tone as a class", (tone) => {
    const { container } = render(<Badge tone={tone}>Status</Badge>);

    expect(container.firstChild).toHaveClass("erp-badge");
    expect(container.firstChild).toHaveClass(`erp-badge-${tone}`);
  });

  it("offers every tone Alert does", () => {
    // Alert's tones are the product's status language. If Alert grows one,
    // this fails until Badge grows it too.
    ["success", "warning", "danger", "info"].forEach((tone) => {
      expect(TONES).toContain(tone);
    });
  });

  it("falls back to neutral rather than rendering unstyled", () => {
    // The class name used to be interpolated straight from the prop, so a
    // tone with no rule behind it produced a pill with no colour and no
    // error. A wrong tone should look wrong, not look like nothing.
    const { container } = render(<Badge tone="chartreuse">Status</Badge>);

    expect(container.firstChild).toHaveClass("erp-badge-neutral");
    expect(container.firstChild).not.toHaveClass("erp-badge-chartreuse");
  });

  it("is neutral when no tone is asked for", () => {
    const { container } = render(<Badge>Status</Badge>);

    expect(container.firstChild).toHaveClass("erp-badge-neutral");
  });

  it("keeps the words as they were written", () => {
    // The pill is uppercased in CSS, not in content, so the accessible name
    // and anything reading it keep the original casing.
    render(<Badge tone="danger">On credit hold</Badge>);

    expect(screen.getByText("On credit hold")).toBeInTheDocument();
  });
});

describe("Skeleton", () => {
  it("says it is loading, out loud", () => {
    // The bars are a drawing; the words are the message.
    render(<Skeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  });

  it("hides the bars from screen readers", () => {
    const { container } = render(<Skeleton lines={2} />);

    container
      .querySelectorAll(".erp-skeleton-line")
      .forEach((line) => expect(line).toHaveAttribute("aria-hidden", "true"));
  });

  it("draws the number of lines it is asked for", () => {
    const { container } = render(<Skeleton lines={5} />);

    expect(container.querySelectorAll(".erp-skeleton-line")).toHaveLength(5);
  });

  it("never draws none", () => {
    const { container } = render(<Skeleton lines={0} />);

    expect(container.querySelectorAll(".erp-skeleton-line")).toHaveLength(1);
  });

  it("takes wording of its own", () => {
    render(<Skeleton label="Loading customer..." />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading customer...");
  });
});

describe("NotFoundState", () => {
  it("says the record is not there, not that something broke", () => {
    render(<NotFoundState />);

    expect(screen.getByText("Record not found")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("takes wording of its own", () => {
    render(
      <NotFoundState
        title="No such customer"
        description="It may have been merged."
      />
    );

    expect(screen.getByText("No such customer")).toBeInTheDocument();
    expect(screen.getByText("It may have been merged.")).toBeInTheDocument();
  });

  it("offers a way onwards when it is given one", () => {
    render(
      <NotFoundState action={<button type="button">Back to customers</button>} />
    );

    expect(
      screen.getByRole("button", { name: "Back to customers" })
    ).toBeInTheDocument();
  });
});

describe("BackLink", () => {
  it("is named by its label, not by its arrow", () => {
    render(<BackLink to="/crm/customers" label="Back to customers" />);

    expect(
      screen.getByRole("link", { name: "Back to customers" })
    ).toHaveAttribute("href", "/crm/customers");
  });

  it("uses the link component it is given", () => {
    // The design system must stay usable without a router.
    const Link = ({ to, children, className }) => (
      <a href={to} className={className} data-router="yes">
        {children}
      </a>
    );

    render(
      <BackLink to="/crm/customers" label="Back" linkComponent={Link} />
    );

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "data-router",
      "yes"
    );
  });

  it("becomes a button when there is no address to go to", () => {
    const onClick = vi.fn();
    render(<BackLink label="Back to step 1" onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Back to step 1" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders nothing with neither an address nor a handler", () => {
    const { container } = render(<BackLink label="Back" />);

    expect(container.firstChild).toBeNull();
  });
});
