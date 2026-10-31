import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import StatCard from "./StatCard";
import StatGrid from "./StatGrid";

describe("StatCard and StatGrid", () => {
  it("renders a stat card with label, value, hint, and tone", () => {
    const { container } = render(
      <StatCard
        label="Active Tenants"
        value={42}
        hint="Across all regions"
        icon="building"
        tone="primary"
      />
    );

    expect(screen.getByText("Active Tenants")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Across all regions")).toBeInTheDocument();

    const card = container.querySelector(".erp-stat-card");
    expect(card).toHaveClass("erp-stat-tone-primary");
  });

  it("displays positive delta trend indicator correctly", () => {
    const { container } = render(
      <StatCard
        label="Monthly Revenue"
        value="$128,000"
        delta={14.5}
      />
    );

    const deltaEl = container.querySelector(".erp-stat-delta");
    expect(deltaEl).toHaveClass("is-up");
    expect(deltaEl).toHaveTextContent("14.5%");
  });

  it("displays negative delta trend indicator correctly", () => {
    const { container } = render(
      <StatCard
        label="Churn Rate"
        value="2.1%"
        delta={-3.2}
      />
    );

    const deltaEl = container.querySelector(".erp-stat-delta");
    expect(deltaEl).toHaveClass("is-down");
    expect(deltaEl).toHaveTextContent("3.2%");
  });

  it("handles click events when onClick is provided", () => {
    const handleClick = vi.fn();
    render(
      <StatCard
        label="Clickable Metric"
        value={100}
        onClick={handleClick}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders StatGrid container with custom column count", () => {
    const { container } = render(
      <StatGrid columns={3}>
        <StatCard label="Tile 1" value={1} />
        <StatCard label="Tile 2" value={2} />
        <StatCard label="Tile 3" value={3} />
      </StatGrid>
    );

    const grid = container.querySelector(".erp-stat-grid");
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveStyle({ "--erp-stat-columns": "3" });
    expect(screen.getByText("Tile 1")).toBeInTheDocument();
    expect(screen.getByText("Tile 2")).toBeInTheDocument();
    expect(screen.getByText("Tile 3")).toBeInTheDocument();
  });
});

