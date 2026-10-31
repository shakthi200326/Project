/**
 * One choice from a list, as a dropdown.
 *
 * A native `<select>`. It is keyboard-operable, type-ahead-searchable and
 * correctly announced everywhere without a line of code from us, and on a
 * phone it becomes the platform's own picker. A custom listbox would cost
 * all of that to gain styling control nobody has asked for.
 *
 * `onChange` receives the event, as it always has, so every filter and form
 * already using this is untouched. The framing is `FormField`'s, which is
 * what brings help text, the required marker and the described-by wiring
 * here without this component growing its own copy.
 */

import FormField from "./FormField";

function Select({
  label = null,
  value,
  onChange,
  options = [],
  placeholder = "",
  disabled = false,
  required = false,
  error = null,
  help = null,
  name = undefined,
  id = undefined,
  prefix = null,
  badge = null,
  action = null,
  className = "",
}) {
  const renderSelect = (field) => {
    const selectElement = (
      <select
        id={field.id}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        required={field.required}
        aria-describedby={field.describedBy}
        aria-invalid={field.invalid}
        className={className || undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    );

    if (prefix) {
      return (
        <div className="erp-input-affix-wrapper has-prefix">
          <span className="erp-input-prefix">{prefix}</span>
          {selectElement}
        </div>
      );
    }

    return selectElement;
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
      {renderSelect}
    </FormField>
  );
}

export default Select;
