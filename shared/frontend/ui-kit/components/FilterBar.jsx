/**
 * The declared filters of a list, as controls.
 *
 * A filter is `{name, label, options, placeholder}` and becomes a `Select`.
 * That is the default, and every filter that names no `type` gets exactly
 * the control it always did.
 *
 * `type: "date"` becomes a date `Input` instead, for an endpoint that reads
 * an ISO day -- the activity endpoints' `date_from` / `date_to` were the
 * first query contract to accept one. A range is two filters, not one
 * control: each end is its own parameter on the server, so each is its own
 * field here, and `min` / `max` / `error` let the caller say how they relate
 * without this component having to know that two of its filters are a pair.
 *
 * Values are held by the caller, not here: the list owns its query, and a
 * filter that remembered its own value would be a second copy of it.
 */
import Input from "./Input";
import Select from "./Select";

function FilterBar({ filters = [], values = {}, onChange }) {
  if (filters.length === 0) return null;

  return (
    <>
      {filters.map((filter) =>
        filter.type === "date" ? (
          <Input
            key={filter.name}
            type="date"
            label={filter.label}
            value={values[filter.name] ?? ""}
            min={filter.min}
            max={filter.max}
            error={filter.error}
            onChange={(event) => onChange(filter.name, event.target.value)}
          />
        ) : (
          <Select
            key={filter.name}
            label={filter.label}
            value={values[filter.name] ?? ""}
            options={filter.options || []}
            placeholder={filter.placeholder || "All"}
            disabled={filter.disabled}
            onChange={(event) => onChange(filter.name, event.target.value)}
          />
        )
      )}
    </>
  );
}

export default FilterBar;
