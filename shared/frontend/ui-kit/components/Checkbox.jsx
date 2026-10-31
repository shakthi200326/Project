/**
 * One yes-or-no choice.
 *
 * Not built on `FormField`, and that is deliberate: a checkbox's label
 * belongs *after* the box and on the same line, so the frame that puts a
 * label above a control is the wrong frame. The wiring is the same wiring
 * -- label pointing at the control, help and error described by it -- done
 * in the shape a checkbox needs.
 *
 * The label wraps the input as well as pointing at it, so the words are
 * part of the hit target. On a dense ERP form that is the difference
 * between a click and a near miss.
 *
 * `onChange` receives the event; read `event.target.checked`.
 */

import { useId } from "react";

function Checkbox({
  label = null,
  checked = false,
  onChange,
  disabled = false,
  required = false,
  error = null,
  help = null,
  name = undefined,
  id: providedId = null,
}) {
  const auto = useId();
  const id = providedId || auto;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;

  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="erp-checkbox-group">
      <label htmlFor={id}>
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={Boolean(checked)}
          onChange={onChange}
          disabled={disabled}
          required={required || undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
        {label}
      </label>

      {help && (
        <span className="erp-field-help" id={helpId}>
          {help}
        </span>
      )}

      {error && (
        <span className="erp-field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default Checkbox;
