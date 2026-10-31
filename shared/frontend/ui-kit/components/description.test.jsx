/**
 * Record data in read mode.
 *
 * The tests that matter here are the structural ones. A description list
 * that renders the right words in the wrong elements looks correct and is
 * useless to a screen reader, and that is the whole reason this is a `<dl>`
 * rather than a grid of divs.
 *
 * The other is the empty value. "Nothing has been entered" and "this failed
 * to load" look identical if a blank is rendered as a blank.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import Badge from "./Badge";
import DescriptionList from "./DescriptionList";
import Field from "./Field";

function list(children) {
  return render(<DescriptionList>{children}</DescriptionList>);
}

describe("DescriptionList", () => {
  it("is a description list", () => {
    const { container } = list(<Field label="Code" value="CUS-00025" />);

    expect(container.querySelector("dl")).not.toBeNull();
  });

  it("renders every field it is given", () => {
    list(
      <>
        <Field label="Code" value="CUS-00025" />
        <Field label="Name" value="Acme Industries" />
        <Field label="GSTIN" value="29ABCDE1234F1Z5" />
      </>
    );

    expect(screen.getAllByRole("term")).toHaveLength(3);
    expect(screen.getAllByRole("definition")).toHaveLength(3);
  });

  it("can be forced to a single column", () => {
    const { container } = render(
      <DescriptionList columns="one">
        <Field label="Notes" value="A long one." />
      </DescriptionList>
    );

    expect(container.firstChild).toHaveClass("erp-description-list-one");
  });
});

describe("Field", () => {
  it("puts the label in a dt and the value in a dd", () => {
    // The association is the point. Without it a screen reader reads six
    // unrelated strings instead of three labelled values.
    const { container } = list(<Field label="Code" value="CUS-00025" />);

    expect(container.querySelector("dt")).toHaveTextContent("Code");
    expect(container.querySelector("dd")).toHaveTextContent("CUS-00025");
  });

  it("keeps each label and value together as one item", () => {
    const { container } = list(<Field label="Code" value="CUS-00025" />);
    const item = container.querySelector(".erp-field");

    expect(item.querySelector("dt")).not.toBeNull();
    expect(item.querySelector("dd")).not.toBeNull();
  });

  it("renders a React node as the value", () => {
    list(<Field label="Status" value={<Badge tone="success">Active</Badge>} />);

    expect(screen.getByText("Active")).toHaveClass("erp-badge-success");
  });

  it("renders a number, including zero", () => {
    // Zero is a fact about the record. Showing a dash instead would be a
    // lie, and a truthiness check is how that happens.
    list(<Field label="Balance" value={0} />);

    expect(screen.getByRole("definition")).toHaveTextContent("0");
    expect(screen.getByRole("definition")).not.toHaveClass("erp-field-empty");
  });

  describe("with no value", () => {
    it("shows a dash for a null value", () => {
      list(<Field label="GSTIN" value={null} />);

      expect(screen.getByRole("definition")).toHaveTextContent("\u2014");
    });

    it("treats undefined and blank strings the same way", () => {
      const { container } = render(
        <DescriptionList>
          <Field label="A" value={undefined} />
          <Field label="B" value="" />
          <Field label="C" value="   " />
        </DescriptionList>
      );

      expect(container.querySelectorAll(".erp-field-empty")).toHaveLength(3);
    });

    it("says so out loud, where the dash says nothing", () => {
      list(<Field label="GSTIN" />);

      expect(screen.getByText("Not set")).toHaveClass("erp-visually-hidden");
    });

    it("hides the dash from screen readers so it is not read twice", () => {
      const { container } = list(<Field label="GSTIN" />);

      expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent(
        "\u2014"
      );
    });

    it("accepts different wording for what empty means", () => {
      list(<Field label="Approved by" emptyText="Not yet approved" />);

      expect(screen.getByText("Not yet approved")).toBeInTheDocument();
    });
  });

  it("lets a long value wrap rather than stretch its column", () => {
    const long = "A".repeat(200);
    list(<Field label="Reference" value={long} />);

    expect(screen.getByRole("definition")).toHaveClass("erp-field-value");
  });
});
