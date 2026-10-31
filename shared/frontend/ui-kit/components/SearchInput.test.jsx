import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import SearchInput, { SEARCH_MAX_LENGTH } from "./SearchInput";

const field = () => screen.getByLabelText("Search");

describe("SearchInput", () => {
  it("renders a labelled search field", () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="Code or name" />);

    const input = field();
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "search");
    expect(input).toHaveAttribute("placeholder", "Code or name");
  });

  it("shows the value it is given", () => {
    render(<SearchInput value="India" onChange={() => {}} />);

    expect(field()).toHaveValue("India");
  });

  it("reports what was typed as a plain string", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);

    fireEvent.change(field(), { target: { value: "EA" } });

    expect(onChange).toHaveBeenCalledExactlyOnceWith("EA");
  });

  it("caps the term at the length the API accepts", () => {
    render(<SearchInput value="" onChange={() => {}} />);

    expect(SEARCH_MAX_LENGTH).toBe(200);
    expect(field()).toHaveAttribute("maxlength", "200");
  });

  it("accepts a narrower cap when a caller asks for one", () => {
    render(<SearchInput value="" onChange={() => {}} maxLength={50} />);

    expect(field()).toHaveAttribute("maxlength", "50");
  });

  it("offers no clear button while the field is empty", () => {
    render(<SearchInput value="" onChange={() => {}} />);

    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("offers a clear button once there is something to clear", () => {
    render(<SearchInput value="EA" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });

  it("clears to an empty string", () => {
    const onChange = vi.fn();
    render(<SearchInput value="EA" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("");
  });

  it("shows it is busy without taking the input away", () => {
    render(<SearchInput value="EA" onChange={() => {}} busy />);

    // The input keeps its value and its place in the DOM, which is what
    // stops focus and the caret being lost mid-search.
    expect(field()).toHaveValue("EA");
    expect(screen.getByRole("status")).toHaveTextContent("Searching...");
  });

  it("says nothing about being busy when it is not", () => {
    render(<SearchInput value="EA" onChange={() => {}} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a validation error against the field", () => {
    render(
      <SearchInput
        value="x"
        onChange={() => {}}
        error="A search term may be at most 200 characters."
      />
    );

    const input = field();
    const message = screen.getByText("A search term may be at most 200 characters.");

    expect(message).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    // The message is announced with the field rather than read out alone.
    expect(input).toHaveAttribute("aria-describedby", message.getAttribute("id"));
  });

  it("is not marked invalid when there is no error", () => {
    render(<SearchInput value="x" onChange={() => {}} />);

    expect(field()).not.toHaveAttribute("aria-invalid");
  });

  it("disables the field and hides the clear button when disabled", () => {
    render(<SearchInput value="EA" onChange={() => {}} disabled />);

    expect(field()).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });
});
