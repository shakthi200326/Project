/**
 * An on/off setting that takes effect as soon as it is flipped.
 *
 * A checkbox and a switch look similar and mean different things. A
 * checkbox is part of a form: ticking it changes nothing until the form is
 * saved. A switch *is* the action -- flipping it turns the thing on. That
 * distinction matters to a screen reader, which announces "switch, on"
 * rather than "checkbox, checked", and it matters to the person using it,
 * who will not go looking for a Save button.
 *
 * So: use `Checkbox` inside a form, and this for a setting that applies
 * immediately. Using this for a form field would promise something the
 * form does not do.
 *
 * Built on a real `<button>` with `role="switch"`, which brings Space,
 * Enter, focus and the disabled state with it rather than reimplementing
 * them on a `<div>`.
 */

import { useId } from "react";

function Switch({
  label,
  checked = false,
  onChange,
  disabled = false,
  busy = false,
  help = null,
  id: providedId = null,
}) {
  const auto = useId();
  const id = providedId || auto;
  const labelId = `${id}-label`;
  const helpId = `${id}-help`;

  return (
    <div className="erp-switch-group">
      <button
        type="button"
        id={id}
        role="switch"
        className="erp-switch"
        aria-checked={Boolean(checked)}
        aria-labelledby={labelId}
        aria-describedby={help ? helpId : undefined}
        // Disabled while the request it started is in flight: flipping it
        // twice is two requests racing to decide the same setting.
        disabled={disabled || busy}
        onClick={() => onChange(!checked)}
      >
        <span className="erp-switch-track" aria-hidden="true">
          <span className="erp-switch-thumb" />
        </span>
      </button>

      {/* Not a `<label>`: a label may only name a form control, and a
          button is not one. `aria-labelledby` names it just as well. */}
      <span className="erp-switch-label" id={labelId}>
        {label}
      </span>

      {help && (
        <span className="erp-field-help" id={helpId}>
          {help}
        </span>
      )}
    </div>
  );
}

export default Switch;
