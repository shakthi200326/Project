import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ICON_NAMES } from "../iconPaths";
import Icon from "./Icon";

describe("Icon", () => {
  it("is decorative by default", () => {
    const { container } = render(<Icon name="receipt" />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("erp-icon");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("is announced when it is given a label", () => {
    render(<Icon name="trash" label="Delete" />);

    expect(screen.getByRole("img", { name: "Delete" })).toBeInTheDocument();
  });

  it("takes a size, a stroke and an extra class", () => {
    const { container } = render(
      <Icon name="x" size={14} strokeWidth={1.75} className="erp-nav-icon" />
    );
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("width", "14");
    expect(svg).toHaveAttribute("stroke-width", "1.75");
    expect(svg).toHaveClass("erp-icon", "erp-nav-icon");
  });

  it("renders nothing for a name it does not know", () => {
    const { container } = render(<Icon name="no-such-glyph" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("draws every glyph in the set", () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector("svg").childElementCount).toBeGreaterThan(0);
      unmount();
    }
  });
});
