/**
 * "Still working" as a block of the page.
 *
 * A live region rather than a bare spinner, so someone who cannot see the
 * animation is told the same thing. `role="status"` is polite on purpose:
 * loading is not an interruption.
 *
 * For a list that already has rows on screen, prefer dimming what is there
 * to replacing it with this -- swapping a table for a spinner on every
 * keystroke is what makes a search feel like it is flashing.
 */
import Spinner from "./Spinner";

function LoadingState({ message = "Loading..." }) {
  return (
    <div className="erp-loading-state" role="status">
      <Spinner />
      {message && <span className="erp-loading-message">{message}</span>}
    </div>
  );
}

export default LoadingState;
