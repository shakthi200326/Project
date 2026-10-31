/**
 * The product's search box.
 *
 * Presentational on purpose: it owns no timer and makes no request, so the
 * same component serves a list that debounces its term (master data) and
 * one that searches on submit. Whoever holds the value decides when it is
 * acted on.
 *
 * `onChange` hands back the string rather than the event, unlike the
 * generic `Input`. The clear button has no input event to forward, and a
 * caller that had to read `event.target.value` from one path and a literal
 * from the other would be doing the component's job.
 *
 * `maxLength` matches the API's own limit, so the ordinary way of using
 * this -- typing -- cannot produce a term the server will reject. The
 * caller still handles the rejection, because a paste through devtools or
 * a future server-side change should not leave a screen with no answer.
 */

import { useId } from "react";

import Icon from "./Icon";

/** The longest term the API accepts. Keep in step with SearchSpec. */
export const SEARCH_MAX_LENGTH = 200;

function SearchInput({
  label = "Search",
  value = "",
  onChange,
  placeholder = "Search...",
  maxLength = SEARCH_MAX_LENGTH,
  error = null,
  busy = false,
  disabled = false,
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const text = value ?? "";

  return (
    <div className="erp-input-group erp-search">
      {label && <label htmlFor={id}>{label}</label>}

      <div className="erp-search-field">
        <input
          id={id}
          type="search"
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />

        {/* A live region rather than a spinner: it says what is happening
            to a screen reader, and the input keeps focus either way. */}
        {busy && (
          <span className="erp-search-busy" role="status">
            Searching...
          </span>
        )}

        {text !== "" && !disabled && (
          <button
            type="button"
            className="erp-search-clear"
            aria-label="Clear search"
            onClick={() => onChange("")}
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {error && (
        <span className="erp-field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

export default SearchInput;
