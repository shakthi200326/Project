/**
 * The list components: table sorting and selection, the toolbar, the bulk
 * bar and the page-size control.
 *
 * The compatibility tests matter as much as the new behaviour. Every Stage 3
 * capability on `Table` and `Pagination` is opt-in, and a caller that passes
 * none of it has to get exactly the component it had before.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import BulkActionBar from "./BulkActionBar";
import FilterBar from "./FilterBar";
import ListToolbar from "./ListToolbar";
import Pagination from "./Pagination";
import Select from "./Select";
import Table from "./Table";

const ROWS = [
  { id: 1, code: "EA", name: "Each" },
  { id: 2, code: "KG", name: "Kilogram" },
];

const COLUMNS = [
  { key: "code", label: "Code", sortable: true },
  { key: "name", label: "Name" },
];

const header = (name) => screen.getByRole("columnheader", { name });

describe("Table, as it was before Stage 3", () => {
  it("renders raw values with no column renderer", () => {
    render(<Table columns={COLUMNS} data={ROWS} />);

    expect(screen.getByText("Each")).toBeInTheDocument();
    expect(screen.getByText("KG")).toBeInTheDocument();
  });

  it("offers no sort controls without a sort handler", () => {
    render(<Table columns={COLUMNS} data={ROWS} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers no checkboxes without a selection", () => {
    render(<Table columns={COLUMNS} data={ROWS} />);

    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("marks no column as sorted when sorting is not wired up", () => {
    render(<Table columns={COLUMNS} data={ROWS} />);

    expect(header("Code")).not.toHaveAttribute("aria-sort");
  });
});

describe("Table sorting", () => {
  it("offers a control only on sortable columns", () => {
    render(<Table columns={COLUMNS} data={ROWS} onSortChange={() => {}} />);

    expect(screen.getByRole("button", { name: /Code/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Name/ })).toBeNull();
  });

  it("reports which column was asked for", () => {
    const onSortChange = vi.fn();
    render(<Table columns={COLUMNS} data={ROWS} onSortChange={onSortChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Code/ }));

    expect(onSortChange).toHaveBeenCalledExactlyOnceWith("code");
  });

  it("announces the current sort direction on the header", () => {
    const { rerender } = render(
      <Table columns={COLUMNS} data={ROWS} sort="code" onSortChange={() => {}} />
    );
    expect(header(/Code/)).toHaveAttribute("aria-sort", "ascending");

    rerender(
      <Table columns={COLUMNS} data={ROWS} sort="-code" onSortChange={() => {}} />
    );
    expect(header(/Code/)).toHaveAttribute("aria-sort", "descending");
  });

  it("says a sortable column is unsorted rather than saying nothing", () => {
    render(<Table columns={COLUMNS} data={ROWS} sort="" onSortChange={() => {}} />);

    expect(header(/Code/)).toHaveAttribute("aria-sort", "none");
  });

  it("does not reorder the rows itself", () => {
    // They are one page of a server-side result; sorting them here would
    // reorder a fraction of the data and look like it had done the job.
    render(
      <Table columns={COLUMNS} data={ROWS} sort="-code" onSortChange={() => {}} />
    );

    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells[0]).toBe("EA");
  });
});

describe("Table selection", () => {
  const selection = (overrides = {}) => ({
    isSelected: () => false,
    toggle: vi.fn(),
    togglePage: vi.fn(),
    allOnPageSelected: false,
    ...overrides,
  });

  it("adds a checkbox per row and one for the page", () => {
    render(<Table columns={COLUMNS} data={ROWS} selection={selection()} />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(
      screen.getByRole("checkbox", { name: "Select all rows on this page" })
    ).toBeInTheDocument();
  });

  it("reports the row that was picked", () => {
    const toggle = vi.fn();
    render(
      <Table columns={COLUMNS} data={ROWS} selection={selection({ toggle })} />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));

    expect(toggle).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("reports a request to select the page", () => {
    const togglePage = vi.fn();
    render(
      <Table columns={COLUMNS} data={ROWS} selection={selection({ togglePage })} />
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all rows on this page" })
    );

    expect(togglePage).toHaveBeenCalledOnce();
  });

  it("shows which rows are selected", () => {
    render(
      <Table
        columns={COLUMNS}
        data={ROWS}
        selection={selection({ isSelected: (id) => id === 2 })}
      />
    );

    expect(screen.getByRole("checkbox", { name: "Select row 2" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select row 1" })).not.toBeChecked();
  });

  it("uses a caller's id function", () => {
    const toggle = vi.fn();
    render(
      <Table
        columns={[{ key: "iso2", label: "ISO" }]}
        data={[{ iso2: "IN" }]}
        getRowId={(row) => row.iso2}
        selection={selection({ toggle })}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));

    expect(toggle).toHaveBeenCalledExactlyOnceWith("IN");
  });
});

describe("Table column renderers", () => {
  it("uses a column's own renderer", () => {
    render(
      <Table
        columns={[{ key: "code", label: "Code", render: (row) => <b>{row.code}!</b> }]}
        data={ROWS}
      />
    );

    expect(screen.getByText("EA!")).toBeInTheDocument();
  });

  it("gives the renderer the whole record, not just the cell", () => {
    const render_ = vi.fn((row) => row.name);
    render(
      <Table columns={[{ key: "code", label: "Code", render: render_ }]} data={[ROWS[0]]} />
    );

    expect(render_).toHaveBeenCalledWith(ROWS[0]);
  });
});

describe("ListToolbar", () => {
  it("renders nothing when it has nothing to hold", () => {
    const { container } = render(<ListToolbar />);

    expect(container.firstChild).toBeNull();
  });

  it("renders what it is given", () => {
    render(
      <ListToolbar
        search={<input aria-label="Search" />}
        actions={<button type="button">Export</button>}
      />
    );

    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });
});

describe("FilterBar", () => {
  const FILTERS = [
    {
      name: "category",
      label: "Category",
      options: [
        { value: "QUANTITY", label: "Quantity" },
        { value: "WEIGHT", label: "Weight" },
      ],
    },
  ];

  it("renders nothing without filters", () => {
    const { container } = render(<FilterBar filters={[]} onChange={() => {}} />);

    expect(container.firstChild).toBeNull();
  });

  it("shows the value it is given rather than one of its own", () => {
    render(
      <FilterBar
        filters={FILTERS}
        values={{ category: "WEIGHT" }}
        onChange={() => {}}
      />
    );

    expect(screen.getByRole("combobox")).toHaveValue("WEIGHT");
  });

  it("reports a change by name", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={FILTERS} values={{}} onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "QUANTITY" },
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith("category", "QUANTITY");
  });

  it("draws a date filter as a date field and reports it by name", () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filters={[{ name: "date_from", label: "From", type: "date", max: "2026-09-30" }]}
        values={{ date_from: "2026-09-01" }}
        onChange={onChange}
      />
    );

    const field = screen.getByLabelText("From");
    expect(field).toHaveAttribute("type", "date");
    expect(field).toHaveValue("2026-09-01");
    expect(field).toHaveAttribute("max", "2026-09-30");

    fireEvent.change(field, { target: { value: "2026-09-02" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("date_from", "2026-09-02");
  });
});

describe("BulkActionBar", () => {
  it("stays out of the way when nothing is selected", () => {
    const { container } = render(<BulkActionBar count={0} />);

    expect(container.firstChild).toBeNull();
  });

  it("says how many are selected", () => {
    render(<BulkActionBar count={3} noun="unit" />);

    expect(screen.getByText("3 units selected")).toBeInTheDocument();
  });

  it("counts one correctly", () => {
    render(<BulkActionBar count={1} noun="unit" />);

    expect(screen.getByText("1 unit selected")).toBeInTheDocument();
  });

  it("offers the caller's actions", () => {
    render(
      <BulkActionBar count={2}>
        <button type="button">Deactivate selected</button>
      </BulkActionBar>
    );

    expect(
      screen.getByRole("button", { name: "Deactivate selected" })
    ).toBeInTheDocument();
  });

  it("clears the selection when asked", () => {
    const onClear = vi.fn();
    render(<BulkActionBar count={2} onClear={onClear} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("Pagination page size", () => {
  const META = { count: 50, page: 1, page_size: 20, total_pages: 3 };

  it("offers no size control unless one is wanted", () => {
    render(<Pagination meta={META} onChange={() => {}} />);

    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows the size currently in use", () => {
    render(
      <Pagination meta={META} onChange={() => {}} onPageSizeChange={() => {}} />
    );

    expect(screen.getByRole("combobox")).toHaveValue("20");
  });

  it("reports a new size as a number", () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        meta={META}
        onChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "50" } });

    expect(onPageSizeChange).toHaveBeenCalledExactlyOnceWith(50);
  });

  it("offers only sizes the API will honour", () => {
    // StandardPagination caps ?size= at 100.
    render(
      <Pagination meta={META} onChange={() => {}} onPageSizeChange={() => {}} />
    );

    const options = within(screen.getByRole("combobox"))
      .getAllByRole("option")
      .map((option) => Number(option.value));

    expect(Math.max(...options)).toBeLessThanOrEqual(100);
  });

  it("still offers the size control on a single-page list", () => {
    render(
      <Pagination
        meta={{ count: 3, page: 1, page_size: 20, total_pages: 1 }}
        onChange={() => {}}
        onPageSizeChange={() => {}}
      />
    );

    expect(screen.getByText("3 record(s)")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("still hides the page buttons on a single-page list", () => {
    render(
      <Pagination
        meta={{ count: 3, page: 1, page_size: 20, total_pages: 1 }}
        onChange={() => {}}
      />
    );

    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });
});

describe("Select labelling", () => {
  it("associates its label with its control", () => {
    // Without htmlFor the label is decoration: clicking it does nothing and
    // the control is announced unnamed.
    render(<Select label="Category" value="" onChange={() => {}} />);

    expect(screen.getByLabelText("Category")).toBe(screen.getByRole("combobox"));
  });

  it("gives two selects on one screen different ids", () => {
    render(
      <>
        <Select label="Category" value="" onChange={() => {}} />
        <Select label="Status" value="" onChange={() => {}} />
      </>
    );

    expect(screen.getByLabelText("Category")).not.toBe(
      screen.getByLabelText("Status")
    );
  });

  it("still works with no label at all", () => {
    render(<Select value="" onChange={() => {}} />);

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("still reports changes and still disables", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Select
        label="Category"
        value=""
        options={[{ value: "A", label: "A" }]}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "A" },
    });
    expect(onChange).toHaveBeenCalledOnce();

    rerender(<Select label="Category" value="" onChange={onChange} disabled />);
    expect(screen.getByLabelText("Category")).toBeDisabled();
  });

  it("reaches a filter by its label", () => {
    render(
      <FilterBar
        filters={[{ name: "category", label: "Category", options: [] }]}
        values={{}}
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText("Category")).toBeInTheDocument();
  });
});
