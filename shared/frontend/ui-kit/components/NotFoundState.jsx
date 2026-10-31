/**
 * "There is no such record."
 *
 * A distinct answer from "something went wrong", and worth its own
 * component so it is phrased the same way on every screen rather than
 * being rebuilt out of `EmptyState` with slightly different words each
 * time. A record that is not there is not a failure of the server, and
 * telling someone the system is broken when the answer is that they
 * mistyped an id sends them to support instead of back to the list.
 *
 * Built on `EmptyState`, because that is what this is a specific case of.
 * The wording is a default, not a rule -- a module with something more
 * useful to say replaces it.
 */

import EmptyState from "./EmptyState";

function NotFoundState({
  title = "Record not found",
  description = "It may have been deleted, or you may not have access to it.",
  action = null,
}) {
  return <EmptyState title={title} description={description} action={action} />;
}

export default NotFoundState;
