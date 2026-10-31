/**
 * A failure, as a block of the page.
 *
 * Takes the error itself rather than a message, so every screen phrases the
 * same failure the same way -- see `describeError`. A screen with a better
 * sentence for one code passes `overrides` instead of formatting its own.
 *
 * `role="alert"` because this replaces content the user was waiting for:
 * unlike loading, it needs saying now rather than when convenient.
 *
 * The retry action is optional and is a plain callback. Whether retrying is
 * even sensible depends on what failed -- a permission error will fail
 * again -- so the caller decides whether to offer it.
 */
import Button from "./Button";
import { describeError } from "../errors";

function ErrorState({
  error = null,
  message = null,
  title = null,
  overrides = {},
  onRetry = null,
  retryLabel = "Try again",
}) {
  const text = message || describeError(error, overrides);

  if (!text && !title) return null;

  return (
    <div className="erp-error-state" role="alert">
      {title && <p className="erp-error-state-title">{title}</p>}
      {text && <p className="erp-error-state-message">{text}</p>}

      {onRetry && (
        <div className="erp-error-state-action">
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;
