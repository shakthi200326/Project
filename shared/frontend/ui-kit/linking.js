/**
 * The link component the design system's own links are drawn with.
 *
 * The design system imports no router, so `BackLink` and `Breadcrumbs` fall
 * back to a plain `<a href>` -- correct, but a full page load: the shell,
 * the sidebar and every provider above them are thrown away and rebuilt.
 * Passing `linkComponent={Link}` on every use is the kind of thing that is
 * forgotten on the next screen, so the application states it once instead:
 *
 *     <LinkComponentProvider value={Link}>...</LinkComponentProvider>
 *
 * An explicit `linkComponent` prop still wins, and outside any provider the
 * plain anchor is what you get, exactly as before.
 */

import { createContext, useContext } from "react";

const LinkComponentContext = createContext(null);

export const LinkComponentProvider = LinkComponentContext.Provider;

export function useLinkComponent(explicit) {
  const provided = useContext(LinkComponentContext);
  return explicit || provided;
}
