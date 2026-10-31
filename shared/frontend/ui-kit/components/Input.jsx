/**
 * A single-line form control.
 *
 * Covers every `<input>` type the product uses -- text, number, date,
 * datetime-local, email, tel -- rather than one component per type. A
 * `DateInput` that rendered `<Input type="date">` and nothing else would
 * be a name for a prop, and twelve of those is twelve files to keep in
 * step with the one that does the work.
 *
 *     <Input label="Name" value={name} onChange={onName} required />
 *     <Input label="Opened" type="date" value={opened} onChange={onOpened} />
 *     <Input label="Credit limit" type="number" min={0} step="0.01" ... />
 *
 * `onChange` receives the event, as it always has, so existing callers are
 * untouched. The framing -- label, required marker, help text, validation
 * message and the ARIA that ties them together -- is `FormField`'s.
 *
 * `type="checkbox"` is kept working and hands over to `Checkbox`, which is
 * where a checkbox belongs: its label goes after the box, not above it.
 * New code should use `Checkbox` directly.
 *
 * `type="password"` gets an eye at its trailing edge that shows and hides
 * what was typed -- every password field, not only the ones somebody
 * remembered to add it to. The value, `name` and `autoComplete` are the
 * same either way, so a password manager sees the field it expects.
 */

import { useState } from "react";

import Checkbox from "./Checkbox";
import IconAction from "./IconAction";
import FormField from "./FormField";

function Input({
  label = null,
  value,
  onChange,
  placeholder = "",
  type = "text",
  disabled = false,
  readOnly = false,
  required = false,
  error = null,
  help = null,
  name = undefined,
  id = undefined,
  min = undefined,
  max = undefined,
  step = undefined,
  maxLength = undefined,
  autoComplete = undefined,
  inputMode = undefined,
  prefix = null,
  suffix = null,
  badge = null,
  action = null,
  className = "",
}) {
  const [revealed, setRevealed] = useState(false);
  const password = type === "password";

  if (type === "checkbox") {
    return (
      <Checkbox
        label={label}
        checked={Boolean(value)}
        onChange={onChange}
        disabled={disabled}
        error={error}
        help={help}
        name={name}
        id={id}
      />
    );
  }

  const renderInput = (field) => {
    const inputElement = (
      <input
        id={field.id}
        name={name}
        type={password && revealed ? "text" : type}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={field.required}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-describedby={field.describedBy}
        aria-invalid={field.invalid}
        className={className || undefined}
      />
    );

    if (password) {
      return (
        <div className="erp-input-reveal">
          {inputElement}
          <IconAction
            icon={revealed ? "hide" : "show"}
            label={revealed ? "Hide password" : "Show password"}
            pressed={revealed}
            onClick={() => setRevealed((was) => !was)}
            disabled={disabled}
          />
        </div>
      );
    }

    if (prefix || suffix) {
      return (
        <div
          className={`erp-input-affix-wrapper ${prefix ? "has-prefix" : ""} ${
            suffix ? "has-suffix" : ""
          }`.trim()}
        >
          {prefix && <span className="erp-input-prefix">{prefix}</span>}
          {inputElement}
          {suffix && <span className="erp-input-suffix">{suffix}</span>}
        </div>
      );
    }

    return inputElement;
  };

  return (
    <FormField
      label={label}
      help={help}
      error={error}
      required={required}
      badge={badge}
      action={action}
      id={id}
    >
      {renderInput}
    </FormField>
  );
}

export default Input;
