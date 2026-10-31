/**
 * The shape of content that has not arrived yet.
 *
 * Worth having on a record screen, where the layout is known before the
 * data is: showing the shape steadies the page instead of collapsing it to
 * a spinner and then jolting it back open. On a list, prefer keeping the
 * rows that are already there and dimming them -- `ListView` does -- since
 * real rows beat a drawing of rows.
 *
 * The bars are decoration and say nothing out loud; the status beside them
 * does, out of sight. Same arrangement as `Spinner` and `LoadingState`,
 * for the same reason: an animation is not a message.
 */
function Skeleton({ lines = 3, width = "full", label = "Loading..." }) {
  const count = Math.max(1, lines);

  return (
    <div className="erp-skeleton" role="status">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={`erp-skeleton-line erp-skeleton-${width}`}
          aria-hidden="true"
        />
      ))}

      <span className="erp-visually-hidden">{label}</span>
    </div>
  );
}

export default Skeleton;
