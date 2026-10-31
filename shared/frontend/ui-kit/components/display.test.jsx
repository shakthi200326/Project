/**
 * How the product writes dates, times and numbers.
 *
 * The rules worth pinning down are the ones that are quietly wrong
 * otherwise: an absent value must not look like a failure, an unparseable
 * one must not be swallowed, and a currency must never be guessed.
 *
 * Formatted output is asserted loosely on purpose. The exact wording comes
 * from `Intl` and varies with the runtime's locale data; asserting the
 * literal string would be testing the browser, and it would break the
 * first time this ran on a machine set to another locale. What is tested
 * is the decision this code makes -- which unit, which currency, whether
 * there is a machine-readable value in the markup at all.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import DateDisplay from "./DateDisplay";
import NumberDisplay from "./NumberDisplay";
import RelativeTime from "./RelativeTime";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
  toDate,
  toNumber,
} from "../formatting";

const ISO = "2026-03-15T09:30:00.000Z";

describe("parsing", () => {
  it("takes ISO strings, Dates and epoch numbers", () => {
    expect(toDate(ISO)).toBeInstanceOf(Date);
    expect(toDate(new Date(ISO))).toBeInstanceOf(Date);
    expect(toDate(Date.parse(ISO))).toBeInstanceOf(Date);
  });

  it("treats nothing as nothing rather than as an invalid date", () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate("")).toBeNull();
    expect(toDate("not a date")).toBeNull();
  });

  it("reads decimals that arrive from Django as strings", () => {
    expect(toNumber("1234.56")).toBe(1234.56);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(null)).toBeNull();
    expect(toNumber("abc")).toBeNull();
  });
});

describe("formatting", () => {
  it("returns an empty string rather than 'Invalid Date'", () => {
    expect(formatDate(null)).toBe("");
    expect(formatNumber(null)).toBe("");
    expect(formatCurrency(null, "INR")).toBe("");
    expect(formatRelativeTime(null)).toBe("");
  });

  it("formats zero as zero, not as nothing", () => {
    // An amount of zero is a fact about the record.
    expect(formatNumber(0)).toBe("0");
  });

  it("uses the currency it is given", () => {
    const inr = formatCurrency(1234.5, "INR", { locale: "en-IN" });
    const usd = formatCurrency(1234.5, "USD", { locale: "en-US" });

    expect(inr).not.toBe(usd);
    expect(usd).toContain("$");
  });

  it("lets the currency decide the decimals", () => {
    // JPY has none; a hard-coded two would be wrong for it.
    expect(formatCurrency(1234, "JPY", { locale: "en-US" })).not.toContain(".");
  });

  it("falls back to a plain number when no currency is given", () => {
    expect(formatCurrency(1234.5, null, { locale: "en-US" })).toBe("1,234.5");
  });

  it("honours an explicit locale", () => {
    expect(formatNumber(1234.5, { locale: "de-DE" })).toBe("1.234,5");
  });
});

describe("relative time", () => {
  const now = Date.parse(ISO);

  it("calls anything under a minute 'now'", () => {
    const text = formatRelativeTime(new Date(now - 20_000), { locale: "en", now });

    expect(text).toMatch(/now/i);
  });

  it("counts backwards in the largest unit that fits", () => {
    expect(
      formatRelativeTime(new Date(now - 3 * 86400_000), { locale: "en", now })
    ).toMatch(/3 days ago/);

    expect(
      formatRelativeTime(new Date(now - 5 * 3600_000), { locale: "en", now })
    ).toMatch(/5 hours ago/);
  });

  it("counts forwards too", () => {
    expect(
      formatRelativeTime(new Date(now + 2 * 86400_000), { locale: "en", now })
    ).toMatch(/in 2 days/);
  });

  it("truncates rather than rounds", () => {
    // Six weeks is "last month", not "2 months ago".
    expect(
      formatRelativeTime(new Date(now - 42 * 86400_000), { locale: "en", now })
    ).toMatch(/last month/i);
  });
});

describe("DateDisplay", () => {
  it("puts a machine-readable value in the markup", () => {
    const { container } = render(<DateDisplay value={ISO} />);
    const time = container.querySelector("time");

    expect(time).not.toBeNull();
    expect(time.getAttribute("datetime")).toBe("2026-03-15");
  });

  it("keeps the full timestamp when asked for the time", () => {
    const { container } = render(<DateDisplay value={ISO} withTime />);

    expect(container.querySelector("time").getAttribute("datetime")).toBe(ISO);
  });

  it("shows an absent date as a dash, and says so out loud", () => {
    // A blank reads as a page that failed to load; this reads as a field
    // nobody has filled in.
    const { container } = render(<DateDisplay value={null} />);

    expect(container.querySelector("time")).toBeNull();
    expect(screen.getByText("Not set")).toHaveClass("erp-visually-hidden");
  });

  it("takes wording of its own for an absent date", () => {
    render(<DateDisplay value={null} emptyText="Never" />);

    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("shows a malformed value rather than hiding it", () => {
    // A date the server sent that will not parse is a data problem
    // somebody needs to see.
    render(<DateDisplay value="15/03/2026" />);

    expect(screen.getByText("15/03/2026")).toBeInTheDocument();
  });
});

describe("RelativeTime", () => {
  const now = Date.parse(ISO);

  it("says how long ago, and keeps the exact moment available", () => {
    const { container } = render(
      <RelativeTime value={new Date(now - 2 * 86400_000)} locale="en" now={now} />
    );
    const time = container.querySelector("time");

    expect(time).toHaveTextContent(/2 days ago/);
    // The precise time is occasionally the whole point on an audit trail.
    expect(time.getAttribute("title")).toBeTruthy();
    expect(time.getAttribute("datetime")).toBeTruthy();
  });

  it("shows nothing as a dash", () => {
    render(<RelativeTime value={null} />);

    expect(screen.getByText("Not set")).toHaveClass("erp-visually-hidden");
  });
});

describe("NumberDisplay", () => {
  it("formats a plain number", () => {
    render(<NumberDisplay value="1234.5" locale="en-US" />);

    expect(screen.getByText("1,234.5")).toBeInTheDocument();
  });

  it("holds the decimals it is told to", () => {
    render(<NumberDisplay value={2} decimals={3} locale="en-US" />);

    expect(screen.getByText("2.000")).toBeInTheDocument();
  });

  it("becomes an amount when given a currency", () => {
    render(<NumberDisplay value={1234.5} currency="USD" locale="en-US" />);

    expect(screen.getByText(/\$1,234\.50/)).toBeInTheDocument();
  });

  it("right-aligns an amount so a column can be scanned", () => {
    const { container } = render(
      <NumberDisplay value={10} currency="USD" locale="en-US" />
    );

    expect(container.firstChild).toHaveClass("erp-number-end");
  });

  it("leaves a plain number where it is", () => {
    const { container } = render(<NumberDisplay value={10} locale="en-US" />);

    expect(container.firstChild).toHaveClass("erp-number-auto");
  });

  it("shows zero rather than a dash", () => {
    render(<NumberDisplay value={0} locale="en-US" />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows an absent number as a dash, and says so out loud", () => {
    render(<NumberDisplay value={null} />);

    expect(screen.getByText("Not set")).toHaveClass("erp-visually-hidden");
  });
});
