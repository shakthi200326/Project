import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import CommandBar from "./CommandBar";

describe("CommandBar", () => {
  it("renders a labelled toolbar with primary action", () => {
    const onPrimaryClick = vi.fn();
    render(
      <CommandBar
        label="Test toolbar"
        primaryAction={{
          label: "New Tenant",
          icon: "plus",
          onClick: onPrimaryClick,
        }}
      />
    );

    const toolbar = screen.getByRole("toolbar", { name: "Test toolbar" });
    expect(toolbar).toBeInTheDocument();

    const primaryBtn = screen.getByRole("button", { name: "New Tenant" });
    expect(primaryBtn).toBeInTheDocument();
    fireEvent.click(primaryBtn);
    expect(onPrimaryClick).toHaveBeenCalledTimes(1);
  });

  it("handles search input and clear button", () => {
    const onSearchChange = vi.fn();
    const onSearchClear = vi.fn();

    render(
      <CommandBar
        search="Acme"
        onSearchChange={onSearchChange}
        onSearchClear={onSearchClear}
        searchPlaceholder="Filter items..."
        searchLabel="Filter records"
      />
    );

    const input = screen.getByLabelText("Filter records");
    expect(input).toHaveValue("Acme");

    fireEvent.change(input, { target: { value: "Omega" } });
    expect(onSearchChange).toHaveBeenCalledWith("Omega");

    const clearBtn = screen.getByRole("button", { name: "Clear search" });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(onSearchClear).toHaveBeenCalledTimes(1);
  });

  it("renders filter tabs and responds to tab clicks", () => {
    const onFilterChange = vi.fn();
    const filters = [
      { key: "all", label: "All Items", count: 12 },
      { key: "active", label: "Active", count: 9 },
      { key: "suspended", label: "Suspended", count: 3 },
    ];

    render(
      <CommandBar
        filters={filters}
        activeFilter="active"
        onFilterChange={onFilterChange}
      />
    );

    const tablist = screen.getByRole("tablist", { name: "Filter status" });
    expect(tablist).toBeInTheDocument();

    const activeTab = screen.getByRole("tab", { name: /Active 9/i });
    expect(activeTab).toHaveAttribute("aria-selected", "true");

    const suspendedTab = screen.getByRole("tab", { name: /Suspended 3/i });
    expect(suspendedTab).toHaveAttribute("aria-selected", "false");
    fireEvent.click(suspendedTab);
    expect(onFilterChange).toHaveBeenCalledWith("suspended");
  });

  it("displays bulk selection bar when items are selected", () => {
    const onClearSelection = vi.fn();
    render(
      <CommandBar
        selectedCount={3}
        selectionNoun="tenant"
        onClearSelection={onClearSelection}
        bulkActions={<button type="button">Delete All</button>}
      />
    );

    expect(screen.getByText(/3 tenants selected/i)).toBeInTheDocument();
    const clearBtn = screen.getByRole("button", { name: "Clear selection" });
    fireEvent.click(clearBtn);
    expect(onClearSelection).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("button", { name: "Delete All" })).toBeInTheDocument();
  });

  it("renders refresh button and responds to refresh trigger", () => {
    const onRefresh = vi.fn();
    render(<CommandBar onRefresh={onRefresh} refreshing={false} />);

    const refreshBtn = screen.getByRole("button", { name: "Refresh records" });
    expect(refreshBtn).toBeInTheDocument();
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("switches view mode between table and grid", () => {
    const onViewModeChange = vi.fn();
    render(
      <CommandBar
        viewMode="table"
        onViewModeChange={onViewModeChange}
      />
    );

    const gridBtn = screen.getByRole("button", { name: "Grid view" });
    expect(gridBtn).toBeInTheDocument();
    fireEvent.click(gridBtn);
    expect(onViewModeChange).toHaveBeenCalledWith("grid");
  });
});

