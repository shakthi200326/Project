/**
 * A multi-line form control.
 *
 * The notes, addresses and descriptions every ERP record carries. Separate
 * from `Input` because the element is a different one -- a `<textarea>`
 * holds its value as a child in HTML and takes `rows` -- not because the
 * framing differs, which is why the framing is shared.
 *
 * `rows` is the initial height only; the control stays resizable, because
 * the person typing a delivery instruction knows better than we do how
 * much room it needs.
 */

import FormField from "./FormField";

function Textarea({
  label = null,
  value,
  onChange,
  placeholder = "",
  rows = 3,
  disabled = false,
  readOnly = false,
  required = false,
  error = null,
  help = null,
  name = undefined,
  id = undefined,
  maxLength = undefined,
}) {
  // A budget the user cannot see is a budget they find out about by being
  // cut off mid-word. Shown only when there is one, and only once it is
  // worth knowing about -- a counter reading "0 / 2000" on an empty field
  // is noise under every textarea on the form.
  const used = String(value ?? "").length;
  const counter =
    maxLength && (used > 0 || error) ? (
      <span
        className={`erp-field-counter${
          used > maxLength * 0.9 ? " is-near-limit" : ""
        }`}
        // Decoration: the control already carries `maxLength`, and a count
        // announced on every keystroke is unusable.
        aria-hidden="true"
      >
        {used} / {maxLength}
      </span>
    ) : null;

  return (
    <FormField
      label={label}
      help={help}
      error={error}
      required={required}
      counter={counter}
      id={id}
    >
      {(field) => (
        <textarea
          id={field.id}
          name={name}
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          readOnly={readOnly}
          required={field.required}
          maxLength={maxLength}
          aria-describedby={field.describedBy}
          aria-invalid={field.invalid}
        />
      )}
    </FormField>
  );
}

export default Textarea;
