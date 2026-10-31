/**
 * A titled panel, and the four ways it can have nothing to show.
 *
 * The shape every dashboard widget and every administration block already
 * had, written twice: a `Card` with a heading, an optional description, an
 * optional action on the right, and a body. Two copies of that is two
 * chances for the heading row to disagree about its height, its type scale
 * or its spacing — which is exactly what had started to happen.
 *
 *     <SectionCard title="Revenue trend" description="Rolling twelve months">
 *       <TrendChart … />
 *     </SectionCard>
 *
 * ## The states are the point
 *
 * A panel that can only render content is a panel whose screen has to handle
 * every other case around it, and a dashboard of eight widgets would carry
 * eight copies of that handling. So the four states a panel actually has are
 * here, drawn with the design system's own components:
 *
 *     loading      Skeleton, and the heading stays — a panel that vanished
 *                  while loading would make the page jump as it filled
 *     error        ErrorState, inside the panel, so one failure costs one
 *                  widget rather than the screen
 *     empty        EmptyState
 *     unavailable  a quiet line saying why, for a widget this person may
 *                  not see or whose module is off
 *
 * `unavailable` is not an error and is not drawn as one. "Your organization
 * does not use Sales" and "the request failed" are different facts, and a
 * user who cannot act on the first should not be shown alarm colours for it.
 *
 * Precedence is unavailable → error → loading → empty → children, so a
 * caller can pass several without deciding an order: the most specific
 * reason a panel has nothing to show is the one drawn.
 *
 * Nothing here fetches, formats or decides permissions. It is the frame;
 * whoever owns the data owns which state it is in.
 */

import Card from "./Card";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import Skeleton from "./Skeleton";

function SectionCard({
  title,
  description = null,
  action = null,
  /** `h2` by default: `PageHeader` owns the page's only `h1`. */
  headingLevel = 2,
  loading = false,
  error = null,
  empty = false,
  emptyTitle = "Nothing to show",
  emptyDescription = null,
  emptyAction = null,
  unavailable = null,
  errorTitle = "Could not be loaded",
  errorOverrides = undefined,
  onRetry = null,
  skeletonLines = 4,
  children = null,
}) {
  const Heading = `h${headingLevel}`;

  const body = () => {
    if (unavailable) {
      return <p className="erp-section-card-unavailable">{unavailable}</p>;
    }

    if (error) {
      return (
        <ErrorState
          title={errorTitle}
          error={error}
          overrides={errorOverrides}
          onRetry={onRetry}
        />
      );
    }

    if (loading) return <Skeleton lines={skeletonLines} label={`Loading ${title}`} />;

    if (empty) {
      return (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      );
    }

    return children;
  };

  return (
    <Card>
      <div className="erp-section-card-head">
        <div className="erp-section-card-heading">
          <Heading className="erp-section-card-title">{title}</Heading>
          {description && (
            <p className="erp-section-card-description">{description}</p>
          )}
        </div>

        {action}
      </div>

      {body()}
    </Card>
  );
}

export default SectionCard;
