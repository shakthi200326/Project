/**
 * Taking the number off the front of a section title.
 *
 * Most forms in the product number their own sections by typing it into
 * the title -- `"1. Deal Identity & Contact Person"`. That makes the
 * number prose: it cannot be styled, it cannot be reused by the stepper at
 * the top of the form, and it is wrong the moment a section is inserted
 * above it.
 *
 * `FormSection` renders the number as a chip and `RecordForm` repeats it
 * in the stepper, so both have to split a title the same way -- a chip
 * reading "2" beside a step reading "2. Pipeline valuation" is the kind of
 * disagreement that only shows up once both are on screen. Hence one
 * function, in a file of its own rather than beside the component, so
 * importing it does not cost that component its fast refresh.
 */

/** `"3. Pipeline valuation"` -> `["3", "Pipeline valuation"]`. */
const NUMBERED = /^\s*(\d{1,2})\s*[.)]\s+(\S.*)$/;

/**
 * The number a section shows and the title it shows beside it.
 *
 * A title that carries its own number keeps it -- a form whose groups are
 * "Step 2a" and "Step 2b" means them -- and one that does not is numbered
 * by `index`, which is where it sits in the form.
 */
export function splitSectionTitle(title, index = null) {
  if (typeof title !== "string") return { number: index, text: title };

  const numbered = NUMBERED.exec(title);
  if (numbered) return { number: numbered[1], text: numbered[2] };

  return { number: index, text: title };
}

export default splitSectionTitle;
