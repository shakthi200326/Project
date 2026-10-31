/**
 * Turning an API failure into something worth showing a person.
 *
 * The API answers every failure with a stable `code` and a `message`. The
 * code is what this branches on -- never the message text, which is prose
 * and will be reworded the first time someone reads it properly.
 *
 * Deliberately duck-typed rather than importing `ApiError`: the design
 * system must not depend on the application's API client. Anything with a
 * `code` and a `message` works here, which also makes these easy to test.
 *
 * Most codes fall through to the server's own message. The server knows
 * what went wrong and says so in words a user can act on ("A search term
 * may be at most 200 characters"), and replacing that with something
 * generic would be throwing away the better message.
 *
 * ## Errors that belong to no single field
 *
 * A validation failure usually names the field it is about, and a form shows
 * it there. Some cannot: a uniqueness rule spanning two columns -- "Company
 * with this Tenant and Code already exists" -- is about the row, so DRF
 * reports it under `__all__` (or `non_field_errors`) rather than under a
 * field.
 *
 * Those were being dropped. `message` for a validation failure is the
 * envelope's generic "Validation failed.", so a duplicate company code
 * showed a form that said only that, with nothing marked and nothing to act
 * on -- while the sentence explaining it sat unread in the payload.
 *
 * So a non-field detail is preferred over the generic message, for the same
 * reason the server's message is preferred over a generic one: it is the
 * specific thing that went wrong. A deliberate override still wins over
 * both.
 */

/** Codes where a generic sentence beats whatever the server said. */
const FRIENDLY = {
  // "You do not have permission to perform this action" is DRF's phrasing
  // and reads like a system talking to itself.
  PERMISSION_DENIED: "You do not have permission to do that.",
  // The server says nothing about internal errors on purpose, so there is
  // no message to preserve.
  INTERNAL_ERROR: "Something went wrong on the server. Please try again.",
};

/**
 * The sentence to show for a failure.
 *
 * `overrides` lets a screen phrase a known code for its own situation --
 * a list saying "You do not have access to this list" rather than the
 * generic permission sentence. Anything not overridden keeps the shared
 * wording, so the phrasing stays consistent by default.
 */
export function describeError(error, overrides = {}) {
  if (!error) return "";

  const code = error.code;

  if (code && Object.prototype.hasOwnProperty.call(overrides, code)) {
    return overrides[code];
  }

  if (code && Object.prototype.hasOwnProperty.call(FRIENDLY, code)) {
    return FRIENDLY[code];
  }

  const general = generalDetail(error.details);
  if (general) return general;

  return error.message || "Something went wrong.";
}

/** The first detail that belongs to the whole record rather than a field. */
function generalDetail(details) {
  if (!details || typeof details !== "object") return null;

  // Both spellings: `__all__` is Django's, `non_field_errors` is DRF's, and
  // which one arrives depends on where the rule was enforced.
  for (const key of ["__all__", "non_field_errors"]) {
    const value = details[key];
    if (!value) continue;

    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string" && first.trim()) return first;
  }

  return null;
}
