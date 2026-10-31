/**
 * Where this screen sits, as an explicit trail.
 *
 * The items are given, never derived: a route tree knows paths, not what a
 * user would call them, and an ERP has screens reachable from more than one
 * place. The caller knows the trail it wants; this draws it.
 *
 * No router is imported here -- the design system must stay usable without
 * one. The application provides its router's link once, through
 * `LinkComponentProvider`, or a caller passes `linkComponent={Link}`;
 * failing both these are plain anchors, which navigate correctly, just with
 * a full page reload.
 *
 * The last item is the current page: rendered as text with `aria-current`,
 * never as a link to where the user already is.
 */
import { useLinkComponent } from "../linking";

function Breadcrumbs({ items = [], linkComponent = null, label = "Breadcrumb", className = "" }) {
  // The application's router link when it has provided one (`linking.js`),
  // so a trail link does not reload the whole shell.
  const Link = useLinkComponent(linkComponent);

  if (items.length === 0) return null;

  const classes = ["erp-breadcrumbs", className].filter(Boolean).join(" ");
  return (
    <nav className={classes} aria-label={label}>
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <li key={item.key || (item.to ? `${item.to}-${index}` : `${item.label}-${index}`)}>
              {last || !item.to ? (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              ) : Link ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <a href={item.to}>{item.label}</a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
