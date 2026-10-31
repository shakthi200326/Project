/**
 * The frame every form control sits in: label, required marker, help text
 * and validation message.
 *
 * One component owns the wiring that is easy to get subtly wrong and
 * impossible to notice by looking: the label pointing at the control, the
 * help text and the error being *described by* it, and the control being
 * marked invalid. Before this, each control did its own -- and `Input` did
 * none of it, rendering a `<label>` with no `htmlFor` beside an input with
 * no `id`, so clicking the label did nothing and a screen reader announced
 * an unnamed textbox.
 *
 * The control is a render prop rather than a child, because the wiring has
 * to reach the element itself:
 *
 *     <FormField label="Credit limit" help="Leave blank for none." required>
 *       {({ id, describedBy, invalid, required }) => (
 *         <input id={id} aria-describedby={describedBy}
 *                aria-invalid={invalid} required={required} />
 *       )}
 *     </FormField>
 *
 * A plain child is accepted too, for a control that wires itself -- a
 * checkbox whose label belongs *after* the box, for instance.
 *
 * `group` switches the frame to a `<fieldset>` with a `<legend>`, which is
 * what a set of radios or checkboxes needs: there is no single element for
 * a `<label>` to point at, and a legend names the whole group instead.
 *
 * Nothing here holds a value or decides what is valid. This is the frame;
 * the control is the control, and validation belongs to whoever owns the
 * form.
 */

import { useId } from "react";

function RequiredMarker() {
  // Decoration only. The control carries `required`, so a screen reader is
  // already told -- an asterisk read out as "star" on top of that is noise.
  //
  // Empty, and drawn entirely by the stylesheet. An asterisk *character*
  // here is a text node inside the `<label>`, which makes the label's text
  // "Credit limit*" rather than "Credit limit" -- and that is the string
  // every `getByLabelText` in the product matches against. The marker is a
  // dot now anyway (see `.erp-field-required`), so the glyph was being
  // pushed out of its own box with `text-indent` and doing nothing but
  // breaking tests on the way: ten of them on the sign-in screen the hour
  // `required` was added to its fields.
  return <span className="erp-field-required" aria-hidden="true" />;
}

function FormField({
  label = null,
  help = null,
  error = null,
  required = false,
  disabled = false,
  group = false,
  badge = null,
  action = null,
  counter = null,
  className = "",
  id: providedId = null,
  children,
}) {
  // A caller with its own id keeps it -- a form driven by field
  // descriptors may want ids it can predict. Otherwise one is made here,
  // which is what stops two fields on one screen colliding.
  const auto = useId();
  const id = providedId || auto;

  const helpId = `${id}-help`;
  const errorId = `${id}-error`;

  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  const control =
    typeof children === "function"
      ? children({
          id,
          describedBy,
          invalid: error ? true : undefined,
          required: required || undefined,
          disabled: disabled || undefined,
        })
      : children;

  const heading = label && (
    badge || action ? (
      <>
        <span className="erp-field-label-text">
          {label}
          {required && <RequiredMarker />}
        </span>
        {badge && <span className="erp-field-badge">{badge}</span>}
        {action && <span className="erp-field-action">{action}</span>}
      </>
    ) : (
      <>
        {label}
        {required && <RequiredMarker />}
      </>
    )
  );

  const body = (
    <>
      {label &&
        (group ? (
          <legend className="erp-field-legend">{heading}</legend>
        ) : (
          <label htmlFor={id}>{heading}</label>
        ))}

      {control}

      {/* Below the control, where it is read in the order it applies: what
          this field is, what to put in it, then what went wrong.

          A counter shares that line rather than taking one of its own: it
          is the same fact as the help text -- how much of this field is
          left -- and a third row under every bounded textarea is a row of
          whitespace repeated down the form. */}
      {help && !counter && (
        <span className="erp-field-help" id={helpId}>
          {help}
        </span>
      )}

      {counter && (
        <span className="erp-field-foot">
          <span className="erp-field-help" id={helpId}>
            {help}
          </span>
          {counter}
        </span>
      )}

      {error && (
        // Announced when it appears. A validation message that arrives
        // after a failed save, while focus is somewhere else entirely, is
        // silent without this -- and silence reads as nothing happening.
        <span className="erp-field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </>
  );

  if (group) {
    return (
      <fieldset className={`erp-input-group erp-field-group ${className}`.trim()} disabled={disabled}>
        {body}
      </fieldset>
    );
  }

  return <div className={`erp-input-group ${className}`.trim()}>{body}</div>;
}

export default FormField;
