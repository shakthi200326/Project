/**
 * One choice from a handful of options, all visible at once.
 *
 * Use this where a `Select` would hide three options behind a click and
 * where seeing them side by side is the point -- a posting type, a rounding
 * rule. Past about seven options a `Select` is kinder.
 *
 * A `<fieldset>` with a `<legend>`, which is the whole reason this is a
 * component: a set of radios with a heading in a `<div>` announces four
 * unrelated choices with no idea what they are choices *about*. The
 * grouping is the accessible part, and it is the part that gets left out.
 *
 * Radios share a `name`, which is what makes them one choice rather than
 * several independent ones -- generated here so two groups on one screen
 * cannot capture each other's clicks.
 *
 * `onChange` receives the chosen value, not the event: there is no single
 * element to read it from, so making the caller dig it out of whichever
 * radio fired would be handing back the component's own job.
 */

import { useId } from "react";

import FormField from "./FormField";

function RadioGroup({
  label = null,
  value = null,
  onChange,
  options = [],
  disabled = false,
  required = false,
  error = null,
  help = null,
  name: providedName = null,
  direction = "vertical",
}) {
  const auto = useId();
  const name = providedName || auto;

  return (
    <FormField
      label={label}
      help={help}
      error={error}
      required={required}
      disabled={disabled}
      group
    >
      <div className={`erp-radio-set erp-radio-set-${direction}`}>
        {options.map((option) => (
          <label key={option.value} className="erp-radio">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              // A single option may be unavailable while the rest are not
              // -- a currency that has been deactivated, say.
              disabled={disabled || option.disabled}
              required={required || undefined}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </FormField>
  );
}

export default RadioGroup;
