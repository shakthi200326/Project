/**
 * Choosing one record out of many, by typing.
 *
 * The control an ERP needs everywhere a `Select` stops working: a customer
 * out of nine thousand, an address already on file, an account from a chart
 * of accounts. A native `<select>` is right up to a few dozen options and
 * useless past that, which is where this begins.
 *
 *     <SearchSelect
 *       label="Address"
 *       value={picked}
 *       options={search.options}
 *       loading={search.loading}
 *       onSearch={search.setTerm}
 *       onChange={setPicked}
 *     />
 *
 * **Presentational, and that is deliberate.** It owns no request and no
 * timer: options arrive as a prop and typing is reported through
 * `onSearch`. That is the same split `SearchInput` and `FilterBar` already
 * make -- whoever owns the query decides when it is acted on -- and it is
 * what keeps the design system free of the API. `core/list/useRecordSearch`
 * is the other half, for callers that want the ordinary behaviour.
 *
 * An option is `{ value, label, description }`. `description` is the second
 * line -- a customer's code beside its name, an address's city -- because
 * in an ERP the label alone is very often ambiguous.
 *
 * Follows the APG combobox pattern: the input keeps focus throughout and
 * `aria-activedescendant` moves the screen reader's attention through the
 * list, rather than focus jumping into it and stranding the typist. Arrow
 * keys move, Enter chooses, Escape closes and then clears.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import FormField from "./FormField";
import Icon from "./Icon";
import Spinner from "./Spinner";

function SearchSelect({
  label = null,
  value = null,
  options = [],
  onChange,
  onSearch = null,
  loading = false,
  disabled = false,
  required = false,
  error = null,
  help = null,
  placeholder = "Type to search...",
  emptyText = "No matches",
  hintText = "Type to search",
  id: providedId = null,
  name = undefined,
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  // Which option the keyboard is on. Not a selection: nothing is chosen
  // until Enter or a click, so arrowing past an option does not pick it.
  const [active, setActive] = useState(0);

  const wrapper = useRef(null);
  const auto = useId();
  const base = providedId || auto;
  const listId = `${base}-list`;
  const optionId = (index) => `${base}-option-${index}`;

  const chosen = value || null;

  const report = useCallback(
    (next) => {
      setTerm(next);
      setActive(0);
      if (onSearch) onSearch(next);
    },
    [onSearch]
  );

  const close = useCallback(() => {
    setOpen(false);
    setActive(0);
  }, []);

  const choose = useCallback(
    (option) => {
      if (!option) return;
      onChange(option);
      // The term goes with it: the field now shows what was chosen, and a
      // leftover search term beside a chosen value reads as unsaved input.
      report("");
      close();
    },
    [onChange, report, close]
  );

  const clear = useCallback(() => {
    onChange(null);
    report("");
  }, [onChange, report]);

  // A click elsewhere closes the list. Without restoring focus: the user
  // has already put it somewhere of their own choosing.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) {
        close();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      // Closes first, and only clears a term that is still there on a
      // second press -- so Escape is never a surprise deletion.
      event.preventDefault();
      if (open) close();
      else if (term) report("");
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (options.length === 0) return;

      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((at) => (at + step + options.length) % options.length);
      return;
    }

    if (event.key === "Enter" && open) {
      // Only when the list is showing: Enter in a closed combobox belongs
      // to the form around it.
      event.preventDefault();
      choose(options[active]);
    }
  };

  return (
    <FormField
      label={label}
      help={help}
      error={error}
      required={required}
      id={base}
    >
      {(field) => (
        <div className="erp-search-select" ref={wrapper}>
          <div className="erp-search-select-control">
            <input
              id={field.id}
              name={name}
              type="text"
              role="combobox"
              className="erp-search-select-input"
              // The chosen label when there is one and nothing is being
              // typed, so the field always says what it holds.
              value={term || (chosen ? chosen.label : "")}
              placeholder={chosen ? "" : placeholder}
              disabled={disabled}
              required={field.required}
              autoComplete="off"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={
                open && options.length > 0 ? optionId(active) : undefined
              }
              aria-describedby={field.describedBy}
              aria-invalid={field.invalid}
              onChange={(event) => {
                setOpen(true);
                report(event.target.value);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
            />

            {loading && (
              <span className="erp-search-select-busy">
                <Spinner size="sm" />
                <span className="erp-visually-hidden">Searching</span>
              </span>
            )}

            {chosen && !disabled && (
              <button
                type="button"
                className="erp-search-select-clear"
                aria-label="Clear selection"
                onClick={clear}
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>

          {open && (
            <ul className="erp-search-select-list" id={listId} role="listbox">
              {options.length === 0 && (
                // Not an option, so it carries no role: there is nothing
                // here to choose, and announcing it as one would be a lie.
                <li className="erp-search-select-note">
                  {loading ? "Searching..." : term ? emptyText : hintText}
                </li>
              )}

              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={chosen ? chosen.value === option.value : false}
                  className={`erp-search-select-option${
                    index === active ? " erp-search-select-active" : ""
                  }`}
                  // Chosen on mousedown rather than click: a click would
                  // first blur the input and close the list underneath the
                  // pointer.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => setActive(index)}
                >
                  <span className="erp-search-select-label">{option.label}</span>
                  {option.description && (
                    <span className="erp-search-select-description">
                      {option.description}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </FormField>
  );
}

export default SearchSelect;
