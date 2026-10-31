/**
 * The title block at the top of an ERP screen.
 *
 * Slots, in the order a reader uses them:
 *   - Where am I in the product (breadcrumbs or back navigation)
 *   - Which area is this (eyebrow)
 *   - What is this screen (title + optional status badge)
 *   - What does it mean (description + optional metadata pills)
 *   - What can I do (header actions)
 *   - Command bar (integrated commands, filters and search)
 *
 * Fully backward-compatible with all existing PageHeader callers.
 */

import BackLink from "./BackLink";
import Badge from "./Badge";

function PageHeader({
  title,
  eyebrow = null,
  description = null,
  breadcrumbs = null,
  backLink = null,
  badge = null,
  meta = null,
  actions = null,
  commandBar = null,
  className = "",
}) {
  const renderBackLink = () => {
    if (!backLink) return null;
    if (backLink.$$typeof || typeof backLink === "function") {
      return backLink;
    }
    if (typeof backLink === "string") {
      return <BackLink to={backLink} label="Back" />;
    }
    return (
      <BackLink
        to={backLink.to}
        label={backLink.label || "Back"}
        onClick={backLink.onClick}
      />
    );
  };

  const renderBadge = () => {
    if (!badge) return null;
    if (badge.$$typeof || typeof badge === "function") {
      return badge;
    }
    return <Badge tone="neutral">{badge}</Badge>;
  };

  const renderMeta = () => {
    if (!meta) return null;
    if (meta.$$typeof || typeof meta === "function") {
      return <div className="erp-page-meta">{meta}</div>;
    }
    if (Array.isArray(meta)) {
      return (
        <div className="erp-page-meta" role="list" aria-label="Page metadata">
          {meta.map((item, idx) => (
            <span key={item.key || idx} className="erp-page-meta-item" role="listitem">
              {item.label && <span className="erp-page-meta-label">{item.label}: </span>}
              <span className="erp-page-meta-val">{item.value ?? item}</span>
            </span>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`erp-page-heading ${className}`.trim()}>
      {/* Top navigation trail */}
      {breadcrumbs || renderBackLink()}

      <div className="erp-page-header">
        <div className="erp-page-titles">
          {eyebrow && <p className="erp-page-eyebrow">{eyebrow}</p>}

          <div className="erp-page-title-row">
            <h1>{title}</h1>
            {renderBadge()}
          </div>

          {description && <p className="erp-page-description">{description}</p>}
          {renderMeta()}
        </div>

        {actions && <div className="erp-page-actions">{actions}</div>}
      </div>

      {commandBar && <div className="erp-page-command-bar">{commandBar}</div>}
    </div>
  );
}

export default PageHeader;
