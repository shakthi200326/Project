/**
 * The form foundation.
 *
 * What is worth testing hardest here is the wiring, because it is the part
 * that is invisible when it is wrong. A label that does not point at its
 * control looks exactly like one that does; an error message that is not
 * referenced by the input reads perfectly well on screen and does not
 * exist to a screen reader. So most of these assert relationships rather
 * than appearances.
 *
 * `Input` had precisely that defect before this stage -- a `<label>` with
 * no `htmlFor` beside an `<input>` with no `id` -- which is why the first
 * test here is the one that would have caught it.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import Checkbox from "./Checkbox";
import FormField from "./FormField";
import FormSection from "./FormSection";
import Input from "./Input";
import RadioGroup from "./RadioGroup";
import Select from "./Select";
import Switch from "./Switch";
import Textarea from "./Textarea";

const noop = () => {};

describe("FormField wiring", () => {
  it("points its label at the control it frames", () => {
    render(
      <FormField label="Credit limit">
        {({ id }) => <input id={id} defaultValue="" />}
      </FormField>
    );

    expect(screen.getByLabelText("Credit limit")).toBe(
      screen.getByRole("textbox")
    );
  });

  it("gives two fields on one screen different ids", () => {
    render(
      <>
        <FormField label="One">{({ id }) => <input id={id} />}</FormField>
        <FormField label="Two">{({ id }) => <input id={id} />}</FormField>
      </>
    );

    expect(screen.getByLabelText("One")).not.toBe(screen.getByLabelText("Two"));
  });

  it("describes the control with its help text", () => {
    render(
      <FormField label="Code" help="Uppercase letters only.">
        {(field) => (
          <input id={field.id} aria-describedby={field.describedBy} />
        )}
      </FormField>
    );

    expect(screen.getByLabelText("Code")).toHaveAccessibleDescription(
      "Uppercase letters only."
    );
  });

  it("describes the control with both help and error at once", () => {
    // The two are not alternatives: "what to put here" is still useful
    // while "what went wrong" is on screen.
    render(
      <FormField label="Code" help="Uppercase only." error="Already taken.">
        {(field) => (
          <input id={field.id} aria-describedby={field.describedBy} />
        )}
      </FormField>
    );

    const description = screen
      .getByLabelText("Code")
      .getAttribute("aria-describedby")
      .split(" ");

    expect(description).toHaveLength(2);
    expect(screen.getByText("Uppercase only.")).toBeInTheDocument();
    expect(screen.getByText("Already taken.")).toBeInTheDocument();
  });

  it("announces a validation message when it appears", () => {
    // A message that arrives after a failed save, while focus is somewhere
    // else, is silent without this.
    render(
      <FormField label="Code" error="Already taken.">
        {(field) => <input id={field.id} aria-invalid={field.invalid} />}
      </FormField>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Already taken.");
  });

  it("marks the control invalid, not just red", () => {
    render(
      <FormField label="Code" error="Already taken.">
        {(field) => <input id={field.id} aria-invalid={field.invalid} />}
      </FormField>
    );

    expect(screen.getByLabelText("Code")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("hides the required asterisk from the accessible name", () => {
    // The control carries `required`, so a screen reader already knows.
    // Reading "star" on top of that is noise.
    const { container } = render(
      <FormField label="Name" required>
        {(field) => <input id={field.id} required={field.required} />}
      </FormField>
    );

    expect(container.querySelector(".erp-field-required")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(screen.getByRole("textbox")).toBeRequired();
  });

  it("groups its children in a fieldset when asked", () => {
    render(
      <FormField label="Posting type" group>
        <input type="radio" name="x" />
      </FormField>
    );

    expect(screen.getByRole("group", { name: "Posting type" })).toBeInTheDocument();
  });
});

describe("Input", () => {
  it("associates its label with its control", () => {
    render(<Input label="Name" value="" onChange={noop} />);

    expect(screen.getByLabelText("Name")).toBe(screen.getByRole("textbox"));
  });

  it("still reports changes as events", () => {
    // Existing callers read event.target.value; that contract is kept.
    // Read at the moment it is called: the control is controlled, so by
    // the time the assertion runs React has already put the old value back.
    let seen = null;
    const onChange = vi.fn((event) => {
      seen = event.target.value;
    });
    render(<Input label="Name" value="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Acme" },
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(seen).toBe("Acme");
  });

  it("disables", () => {
    render(<Input label="Name" value="" onChange={noop} disabled />);

    expect(screen.getByLabelText("Name")).toBeDisabled();
  });

  it("is read-only without being disabled", () => {
    // A disabled input is skipped by the keyboard, which hides the value
    // from anyone navigating by Tab. Read-only keeps it reachable.
    render(<Input label="Code" value="CUS-1" onChange={noop} readOnly />);

    const input = screen.getByLabelText("Code");
    expect(input).toHaveAttribute("readonly");
    expect(input).not.toBeDisabled();
  });

  it("carries its error to the control", () => {
    render(
      <Input label="Name" value="" onChange={noop} error="Name is required." />
    );

    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(
      "Name is required."
    );
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });

  it("carries the type it is given", () => {
    render(<Input label="Opened" type="date" value="" onChange={noop} />);

    expect(screen.getByLabelText("Opened")).toHaveAttribute("type", "date");
  });

  it("passes numeric bounds through", () => {
    render(
      <Input
        label="Quantity"
        type="number"
        value=""
        onChange={noop}
        min={0}
        step="0.01"
      />
    );

    const input = screen.getByLabelText("Quantity");
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("step", "0.01");
  });

  it("hands a checkbox over to Checkbox", () => {
    // The old spelling stays working; the label ends up after the box.
    let seen = null;
    const onChange = vi.fn((event) => {
      seen = event.target.checked;
    });
    render(
      <Input type="checkbox" label="Active" value onChange={onChange} />
    );

    const box = screen.getByLabelText("Active");
    expect(box).toBeChecked();

    fireEvent.click(box);
    expect(seen).toBe(false);
  });
});

describe("Textarea", () => {
  it("is labelled and reports changes", () => {
    let seen = null;
    const onChange = vi.fn((event) => {
      seen = event.target.value;
    });
    render(<Textarea label="Notes" value="" onChange={onChange} />);

    const box = screen.getByLabelText("Notes");
    fireEvent.change(box, { target: { value: "Call back Monday." } });

    expect(seen).toBe("Call back Monday.");
  });

  it("takes a row count and still disables", () => {
    render(<Textarea label="Notes" value="" onChange={noop} rows={6} disabled />);

    expect(screen.getByLabelText("Notes")).toHaveAttribute("rows", "6");
    expect(screen.getByLabelText("Notes")).toBeDisabled();
  });

  it("reports its error", () => {
    render(<Textarea label="Notes" value="" onChange={noop} error="Too long." />);

    expect(screen.getByLabelText("Notes")).toHaveAccessibleDescription("Too long.");
  });
});

describe("Checkbox", () => {
  it("puts its label on the control", () => {
    render(<Checkbox label="Active" checked onChange={noop} />);

    expect(screen.getByRole("checkbox", { name: "Active" })).toBeChecked();
  });

  it("reports the new state", () => {
    let seen = null;
    const onChange = vi.fn((event) => {
      seen = event.target.checked;
    });
    render(<Checkbox label="Active" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Active" }));

    expect(seen).toBe(true);
  });

  it("disables", () => {
    render(<Checkbox label="Active" checked onChange={noop} disabled />);

    expect(screen.getByRole("checkbox", { name: "Active" })).toBeDisabled();
  });

  it("describes itself with its error", () => {
    render(
      <Checkbox
        label="Accepted"
        checked={false}
        onChange={noop}
        error="You must accept."
      />
    );

    expect(
      screen.getByRole("checkbox", { name: "Accepted" })
    ).toHaveAccessibleDescription("You must accept.");
  });
});

describe("RadioGroup", () => {
  const OPTIONS = [
    { value: "debit", label: "Debit" },
    { value: "credit", label: "Credit" },
  ];

  it("is a named group, not a row of loose radios", () => {
    // Without the grouping a screen reader announces two unrelated choices
    // with no idea what they are choices about.
    render(
      <RadioGroup label="Posting type" value="debit" options={OPTIONS} onChange={noop} />
    );

    expect(screen.getByRole("group", { name: "Posting type" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("shows which option is chosen", () => {
    render(
      <RadioGroup label="Posting type" value="credit" options={OPTIONS} onChange={noop} />
    );

    expect(screen.getByRole("radio", { name: "Credit" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Debit" })).not.toBeChecked();
  });

  it("reports the chosen value rather than the event", () => {
    const onChange = vi.fn();
    render(
      <RadioGroup label="Posting type" value="debit" options={OPTIONS} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Credit" }));

    expect(onChange).toHaveBeenCalledWith("credit");
  });

  it("keeps two groups on one screen independent", () => {
    // Shared radio names would make one group capture the other's clicks.
    render(
      <>
        <RadioGroup label="First" value="debit" options={OPTIONS} onChange={noop} />
        <RadioGroup label="Second" value="credit" options={OPTIONS} onChange={noop} />
      </>
    );

    const [first, second] = screen.getAllByRole("group");

    expect(first.querySelector("input").name).not.toBe(
      second.querySelector("input").name
    );
  });

  it("disables one option without disabling the rest", () => {
    render(
      <RadioGroup
        label="Posting type"
        value="debit"
        onChange={noop}
        options={[OPTIONS[0], { ...OPTIONS[1], disabled: true }]}
      />
    );

    expect(screen.getByRole("radio", { name: "Credit" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Debit" })).not.toBeDisabled();
  });

  it("disables every option when the group is disabled", () => {
    render(
      <RadioGroup
        label="Posting type"
        value="debit"
        options={OPTIONS}
        onChange={noop}
        disabled
      />
    );

    screen.getAllByRole("radio").forEach((radio) => expect(radio).toBeDisabled());
  });
});

describe("Switch", () => {
  it("is announced as a switch, with its state", () => {
    render(<Switch label="Email alerts" checked onChange={noop} />);

    expect(screen.getByRole("switch", { name: "Email alerts" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("reports the state it is being moved to", () => {
    const onChange = vi.fn();
    render(<Switch label="Email alerts" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("is operable from the keyboard", () => {
    // Free, because it is a real button -- which is the reason it is one.
    const onChange = vi.fn();
    render(<Switch label="Email alerts" checked={false} onChange={onChange} />);

    const control = screen.getByRole("switch");
    control.focus();
    expect(control).toHaveFocus();

    fireEvent.click(control);
    expect(onChange).toHaveBeenCalled();
  });

  it("cannot be flipped again while its request is running", () => {
    const onChange = vi.fn();
    render(<Switch label="Email alerts" checked onChange={onChange} busy />);

    const control = screen.getByRole("switch");
    expect(control).toBeDisabled();

    fireEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables", () => {
    render(<Switch label="Email alerts" checked onChange={noop} disabled />);

    expect(screen.getByRole("switch")).toBeDisabled();
  });
});

describe("Select keeps its contract while gaining the shared framing", () => {
  it("still labels, still reports changes, still disables", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Select
        label="Currency"
        value=""
        options={[{ value: "INR", label: "INR" }]}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Currency"), {
      target: { value: "INR" },
    });
    expect(onChange).toHaveBeenCalledOnce();

    rerender(<Select label="Currency" value="" onChange={onChange} disabled />);
    expect(screen.getByLabelText("Currency")).toBeDisabled();
  });

  it("now carries help text and validation like every other control", () => {
    render(
      <Select
        label="Currency"
        value=""
        onChange={noop}
        error="Choose a currency."
      />
    );

    expect(screen.getByLabelText("Currency")).toHaveAccessibleDescription(
      "Choose a currency."
    );
  });

  it("can disable a single option", () => {
    render(
      <Select
        label="Currency"
        value=""
        onChange={noop}
        options={[{ value: "XXX", label: "Retired", disabled: true }]}
      />
    );

    expect(screen.getByRole("option", { name: "Retired" })).toBeDisabled();
  });
});


describe("FormSection", () => {
  it("groups its fields in a fieldset so the legend is announced with each one", () => {
    // The reason this is a fieldset and not a div with a heading: a screen
    // reader reads the legend as part of every control inside it, so the
    // field does not have to carry the word itself.
    render(
      <FormSection title="Commercial">
        <Input label="Price" value="" onChange={() => {}} />
      </FormSection>
    );

    const group = screen.getByRole("group", { name: /Commercial/ });
    expect(group.tagName).toBe("FIELDSET");
    expect(group).toContainElement(screen.getByLabelText("Price"));
  });

  it("puts the description in the accessible name too", () => {
    render(
      <FormSection title="Identity" description="How this plan is named.">
        <Input label="Name" value="" onChange={() => {}} />
      </FormSection>
    );

    expect(
      screen.getByRole("group", { name: /Identity.*How this plan is named\./ })
    ).toBeInTheDocument();
  });

  it("is still a usable group with no title at all", () => {
    // A section used purely for layout should not invent an empty legend.
    const { container } = render(
      <FormSection>
        <Input label="Code" value="" onChange={() => {}} />
      </FormSection>
    );

    expect(container.querySelector("legend")).toBeNull();
    expect(container.querySelector(".erp-form-section-fields")).not.toBeNull();
  });

  it("keeps its fields in a grid of its own, matching the form's", () => {
    // What lets a form adopt sections one group at a time: a field lands in
    // the same place whether or not it is wrapped.
    const { container } = render(
      <FormSection title="Access">
        <Input label="Role" value="" onChange={() => {}} />
      </FormSection>
    );

    const fields = container.querySelector(".erp-form-section-fields");
    expect(fields.parentElement).toHaveClass("erp-form-section");
  });
});
