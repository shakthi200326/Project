/**
 * Loading and error states, and the error wording they share.
 *
 * `describeError` is the part worth testing hardest: it is the single place
 * that decides what a user reads when something fails, and the rule it
 * encodes -- branch on the code, keep the server's sentence otherwise -- is
 * easy to erode one screen at a time.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";
import Spinner from "./Spinner";
import Table from "./Table";
import TableLoader from "./TableLoader";
import { describeError } from "../errors";

const failure = (code, message) => ({ code, message });

describe("Spinner", () => {
  it("is hidden from screen readers", () => {
    // A spinning circle says nothing out loud; the words beside it do.
    const { container } = render(<Spinner />);

    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("accepts a size", () => {
    const { container } = render(<Spinner size="lg" />);

    expect(container.firstChild).toHaveClass("erp-spinner-lg");
  });
});

describe("LoadingState", () => {
  it("says it is loading, out loud", () => {
    render(<LoadingState />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  });

  it("accepts a message of its own", () => {
    render(<LoadingState message="Fetching units..." />);

    expect(screen.getByRole("status")).toHaveTextContent("Fetching units...");
  });

  it("can show the indicator with no words", () => {
    render(<LoadingState message={null} />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent("");
  });
});

describe("describeError", () => {
  it("rewords a permission failure", () => {
    expect(
      describeError(failure("PERMISSION_DENIED", "You do not have permission to perform this action."))
    ).toBe("You do not have permission to do that.");
  });

  it("says nothing internal about a server error", () => {
    expect(describeError(failure("INTERNAL_ERROR", "An unexpected error occurred."))).toBe(
      "Something went wrong on the server. Please try again."
    );
  });

  it("keeps the server's own message for everything else", () => {
    // The server's sentence is the useful one here; a generic replacement
    // would be strictly worse.
    expect(
      describeError(failure("VALIDATION_ERROR", "A search term may be at most 200 characters."))
    ).toBe("A search term may be at most 200 characters.");
  });

  it("lets a screen override a code for its own situation", () => {
    expect(
      describeError(failure("PERMISSION_DENIED", "nope"), {
        PERMISSION_DENIED: "You do not have access to this list.",
      })
    ).toBe("You do not have access to this list.");
  });

  it("falls back when the failure has no message at all", () => {
    expect(describeError({ code: "WEIRD" })).toBe("Something went wrong.");
  });

  it("has nothing to say about no error", () => {
    expect(describeError(null)).toBe("");
  });

  // --- errors that belong to no single field -----------------------------
  //
  // A uniqueness rule spanning two columns is about the row, not a field, so
  // it arrives under `__all__` and a form has nowhere to put it. Before this
  // it was dropped: a duplicate company code showed "Validation failed." and
  // nothing else, while the sentence explaining it sat unread in the payload.

  it("prefers a non-field detail over the envelope's generic message", () => {
    expect(
      describeError({
        code: "VALIDATION_ERROR",
        message: "Validation failed.",
        details: { __all__: ["Company with this Tenant and Code already exists."] },
      })
    ).toBe("Company with this Tenant and Code already exists.");
  });

  it("understands DRF's spelling of the same thing", () => {
    expect(
      describeError({
        code: "VALIDATION_ERROR",
        message: "Validation failed.",
        details: { non_field_errors: ["These two do not go together."] },
      })
    ).toBe("These two do not go together.");
  });

  it("takes a bare string as readily as a list", () => {
    expect(
      describeError({
        code: "VALIDATION_ERROR",
        message: "Validation failed.",
        details: { __all__: "Already exists." },
      })
    ).toBe("Already exists.");
  });

  it("leaves field errors to the fields they name", () => {
    // A form shows these beside their own control; repeating one at the top
    // would say the same thing twice and point at nothing.
    expect(
      describeError({
        code: "VALIDATION_ERROR",
        message: "Validation failed.",
        details: { code: ["This field is required."] },
      })
    ).toBe("Validation failed.");
  });

  it("still lets a deliberate override win", () => {
    expect(
      describeError(
        {
          code: "PERMISSION_DENIED",
          message: "nope",
          details: { __all__: ["Something specific."] },
        },
        { PERMISSION_DENIED: "You do not have access to this list." }
      )
    ).toBe("You do not have access to this list.");
  });

  it("still rewords a permission failure that carries details", () => {
    expect(
      describeError({
        code: "PERMISSION_DENIED",
        message: "raw",
        details: { __all__: ["Something specific."] },
      })
    ).toBe("You do not have permission to do that.");
  });

  it("is unbothered by details that are not an object", () => {
    expect(
      describeError({ code: "VALIDATION_ERROR", message: "Validation failed.", details: "oops" })
    ).toBe("Validation failed.");
  });
});

describe("ErrorState", () => {
  it("reports a failure as an alert", () => {
    render(<ErrorState error={failure("VALIDATION_ERROR", "Bad input.")} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Bad input.");
  });

  it("uses the shared wording for a permission failure", () => {
    render(<ErrorState error={failure("PERMISSION_DENIED", "raw")} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "You do not have permission to do that."
    );
  });

  it("honours an override", () => {
    render(
      <ErrorState
        error={failure("PERMISSION_DENIED", "raw")}
        overrides={{ PERMISSION_DENIED: "You do not have access to this list." }}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "You do not have access to this list."
    );
  });

  it("accepts a plain message instead of an error", () => {
    render(<ErrorState message="Nothing loaded." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Nothing loaded.");
  });

  it("shows a title when given one", () => {
    render(<ErrorState title="Could not load units" message="Try later." />);

    expect(screen.getByText("Could not load units")).toBeInTheDocument();
  });

  it("offers no retry unless the caller wants one", () => {
    // Retrying a permission failure just fails again.
    render(<ErrorState error={failure("PERMISSION_DENIED", "raw")} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("calls back when retry is used", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Offline." onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders nothing when there is nothing to report", () => {
    const { container } = render(<ErrorState />);

    expect(container.firstChild).toBeNull();
  });
});

describe("TableLoader", () => {
  it("is a polite status that says what is on its way", () => {
    render(<TableLoader />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Loading data...");
  });

  it("can be drawn without being announced", () => {
    render(<TableLoader announce={false} />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Table while loading", () => {
  const columns = [{ key: "name", label: "Name" }];

  it("keeps exactly its old markup for a caller that never mentions loading", () => {
    const { container } = render(<Table columns={columns} data={[{ id: 1, name: "Each" }]} />);

    expect(container.querySelector(".erp-table-loading")).toBeNull();
  });

  it("stands the loader in for a table with nothing to show yet", () => {
    render(<Table columns={columns} data={[]} loading />);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading data...");
  });

  it("lays the loader over rows already on screen and takes their clicks", () => {
    const { container } = render(
      <Table columns={columns} data={[{ id: 1, name: "Each" }]} loading />
    );

    expect(screen.getByText("Each")).toBeInTheDocument();
    expect(container.querySelector(".erp-table-loader-overlay")).not.toBeNull();
    const region = screen.getByRole("region", { name: "Records" });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveAttribute("inert");
  });

  it("gives the rows back when loading finishes", () => {
    const { container, rerender } = render(
      <Table columns={columns} data={[{ id: 1, name: "Each" }]} loading />
    );
    rerender(<Table columns={columns} data={[{ id: 1, name: "Each" }]} loading={false} />);

    expect(container.querySelector(".erp-table-loader")).toBeNull();
    const region = screen.getByRole("region", { name: "Records" });
    expect(region).not.toHaveAttribute("aria-busy");
    expect(region).not.toHaveAttribute("inert");
  });
});
