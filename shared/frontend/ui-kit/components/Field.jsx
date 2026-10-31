/**
 * One label and its value, inside a `DescriptionList`.
 *
 * Read-only, and only that. There is no input here and there must not be:
 * a form field has to own validation, a name and a change handler, and the
 * moment those appear on this component every read-mode screen starts
 * carrying them. The form primitives are a later stage.
 *
 * The `<dt>` and `<dd>` are wrapped in a `<div>`, which a `<dl>` allows as
 * an alternative to holding them directly. That keeps each label-and-value
 * a single item for the surrounding grid to place, so the two can never be
 * split across a column boundary from each other -- and the association
 * the definition list exists for survives either way.
 *
 * `value` may be any node, so a status renders as a `Badge` and an amount
 * as whatever the caller has already formatted. Nothing here formats
 * anything: dates, currency and numbers are locale decisions, and a
 * display primitive guessing at them is how two screens end up disagreeing
 * about what the same number looks like.
 */

/** What an absent value looks like. */
const EMPTY = "\u2014";

/**
 * Whether there is anything worth showing.
 *
 * `0` and `false` are values and are shown; `null`, `undefined` and a
 * string of nothing but spaces are not. An amount of zero is a fact about
 * the record, and printing a dash instead of it would be a lie.
 */
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  return typeof value === "string" && value.trim() === "";
}

function Field({ label, value = null, emptyText = "Not set" }) {
  const empty = isEmpty(value);

  return (
    <div className="erp-field">
      <dt className="erp-field-label">{label}</dt>
      <dd className={`erp-field-value${empty ? " erp-field-empty" : ""}`}>
        {empty ? (
          <>
            {/* The dash is for the eye and says nothing out loud; the words
                beside it are for the ear and are not drawn. An empty `dd`
                would be announced as the label followed by silence, which
                reads as a page that failed to load rather than a field
                nobody has filled in. */}
            <span aria-hidden="true">{EMPTY}</span>
            <span className="erp-visually-hidden">{emptyText}</span>
          </>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export default Field;
