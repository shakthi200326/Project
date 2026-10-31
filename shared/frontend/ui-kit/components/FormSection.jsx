/**
 * A named group of fields inside a form.
 *
 * A twelve-field record drawn as one undifferentiated grid asks the reader
 * to work out for themselves which fields belong together. Three named
 * groups of four answer that before they start, and the saving is not
 * cosmetic: it is the difference between scanning for a field and hunting
 * for one.
 *
 *     <FormSection title="Identity" description="How this plan is named.">
 *       <Input … />
 *       <Input … />
 *     </FormSection>
 *
 * ## Why a fieldset
 *
 * Because this *is* the element the platform already has for the job. A
 * `div` with an `h3` looks the same and says nothing: a screen reader
 * announces a `legend` as part of every control inside it, so "Price" in a
 * fieldset called "Commercial" is read as "Commercial, Price" without the
 * field having to carry the word itself. A heading beside the fields
 * cannot do that.
 *
 * `fieldset` needs `min-width: 0` to be allowed to shrink inside a grid --
 * its default `min-content` width is a long-standing browser quirk and is
 * why a fieldset so often refuses to narrow on a phone. That lives in the
 * stylesheet with the rest of the reset.
 *
 * ## The number
 *
 * Most forms in the product were already numbering their sections by
 * typing it into the title -- `"1. Deal Identity & Contact Person"`. That
 * makes the number prose: it cannot be styled, it cannot be reused by the
 * stepper at the top of the form, and it is wrong the moment a section is
 * inserted above it.
 *
 * So the number is taken off the title by `splitSectionTitle` and
 * rendered as a chip, and `RecordForm` hands down the position it worked
 * out for itself. A title that carries its own number keeps that number --
 * a form whose sections are "Step 2a" and "Step 2b" means it -- and one
 * that does not is numbered by where it sits.
 *
 * `index={false}` opts out entirely, for a form with one section or with
 * groups that are not a sequence.
 *
 * ## Layout
 *
 * A section always spans the full width of the form it is in and lays its
 * own children out in the same two-column grid the form uses, so flat
 * forms and sectioned forms put a field in the same place. Forms are free
 * to mix them: a section and a loose field can sit in one form, which is
 * what makes adopting this one group at a time possible.
 */

import { splitSectionTitle } from "./sectionTitle";

function FormSection({
  title,
  description = null,
  icon = null,
  badge = null,
  columns = 2,
  index = null,
  action = null,
  id = undefined,
  children,
  className = "",
}) {
  const colClass =
    columns === 1
      ? "erp-form-fields--1col"
      : columns === 3
      ? "erp-form-fields--3col"
      : columns === 4
      ? "erp-form-fields--4col"
      : "";

  const { number, text } = splitSectionTitle(
    title,
    index === false ? null : index
  );

  // An icon and a number are both the thing on the left of the heading, so
  // only one of them is drawn. The icon wins: a module that went to the
  // trouble of choosing one meant it.
  const marker = icon ? (
    <span className="erp-form-section-icon" aria-hidden="true">
      {icon}
    </span>
  ) : number != null ? (
    // Decoration. The number says where the section sits, which the
    // document order already tells a screen reader.
    <span className="erp-form-section-index" aria-hidden="true">
      {number}
    </span>
  ) : null;

  return (
    <fieldset id={id} className={`erp-form-section ${className}`.trim()}>
      {(text || description) && (
        <legend className="erp-form-section-legend">
          <div className="erp-form-section-header">
            {marker}
            <div className="erp-form-section-titles">
              {text && <span className="erp-form-section-title">{text}</span>}
              {description && (
                <span className="erp-form-section-description">
                  {description}
                </span>
              )}
            </div>
            {badge && <span className="erp-form-section-badge">{badge}</span>}
            {action && <div className="erp-form-section-action">{action}</div>}
          </div>
        </legend>
      )}
      <div className={`erp-form-section-fields ${colClass}`.trim()}>
        {children}
      </div>
    </fieldset>
  );
}

export default FormSection;
