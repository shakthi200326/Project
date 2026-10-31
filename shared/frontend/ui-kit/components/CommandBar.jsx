/**
 * A standardized Command Bar for ONE ERP list and administrative screens.
 *
 * Integrates the essential toolbar controls in a consistent, responsive,
 * accessible strip:
 *
 *   1. Primary action (e.g. "+ Create Tenant", "+ Add Company", "+ New Role")
 *   2. Secondary action buttons or group actions
 *   3. Integrated search field with clear and keyboard shortcut support
 *   4. Segmented filter tabs/pills (e.g. All, Active, Suspended, Expired)
 *   5. Seamless selection & bulk actions when rows are checked
 *   6. Quick refresh trigger with loading state
 *   7. View mode toggle (Table / Grid)
 *
 * Both Platform Admin and Tenant Admin screens compose this single component
 * rather than inventing ad-hoc search boxes, fragmented button bars, or
 * conflicting toolbar layouts.
 */

import { useRef } from "react";
import Button from "./Button";
import Icon from "./Icon";
import SearchInput from "./SearchInput";

export default function CommandBar({
  primaryAction = null,
  secondaryActions = null,
  search = "",
  onSearchChange = null,
  searchPlaceholder = "Search records…",
  searchLabel = "Search records",
  onSearchClear = null,
  filters = null,
  filterTabs = null,
  activeFilter = "",
  onFilterChange = null,
  selectedCount = 0,
  selectionNoun = "record",
  bulkActions = null,
  onClearSelection = null,
  onRefresh = null,
  refreshing = false,
  viewMode = null,
  onViewModeChange = null,
  extra = null,
  className = "",
  label = "Commands and filters",
}) {
  const searchInputRef = useRef(null);
  const hasSelection = selectedCount > 0;
  const resolvedFilters = filters || filterTabs || null;

  const renderPrimary = () => {
    if (!primaryAction) return null;
    if (primaryAction.$$typeof || typeof primaryAction === "function") {
      return primaryAction;
    }
    const {
      label: btnLabel,
      icon = "plus",
      onClick,
      to,
      disabled = false,
      variant = "primary",
      ariaLabel,
    } = primaryAction;

    return (
      <Button
        variant={variant}
        onClick={onClick}
        to={to}
        disabled={disabled}
        aria-label={ariaLabel}
        className="erp-command-primary"
      >
        {icon && <Icon name={icon} size={15} />}
        <span>{btnLabel}</span>
      </Button>
    );
  };

  const renderSecondaryActions = () => {
    if (!secondaryActions) return null;
    if (Array.isArray(secondaryActions)) {
      return secondaryActions.map((action, idx) => {
        if (!action) return null;
        if (action.$$typeof || typeof action === "function") {
          return <span key={idx}>{action}</span>;
        }
        const {
          label: actLabel,
          icon = null,
          onClick,
          disabled = false,
          variant = "secondary",
          key = idx,
        } = action;
        return (
          <Button
            key={key}
            variant={variant}
            onClick={onClick}
            disabled={disabled}
            className="erp-command-action"
          >
            {icon && <Icon name={icon} size={14} />}
            <span>{actLabel}</span>
          </Button>
        );
      });
    }
    return secondaryActions;
  };

  return (
    <div
      className={`erp-command-bar ${hasSelection ? "has-selection" : ""} ${className}`.trim()}
      role="toolbar"
      aria-label={label}
    >
      {/* --- Active Selection Mode --- */}
      {hasSelection ? (
        <div className="erp-command-selection-row" role="region" aria-label="Selection commands">
          <div className="erp-command-selection-info">
            <span className="erp-command-selection-count">
              <strong>{selectedCount}</strong> {selectionNoun}
              {selectedCount === 1 ? "" : "s"} selected
            </span>
            {onClearSelection && (
              <button
                type="button"
                className="erp-command-selection-clear"
                onClick={onClearSelection}
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="erp-command-selection-actions">
            {bulkActions}
          </div>
        </div>
      ) : (
        /* --- Normal Operations Mode --- */
        <div className="erp-command-main-row">
          <div className="erp-command-left">
            {renderPrimary()}
            {renderSecondaryActions()}

            {resolvedFilters && resolvedFilters.length > 0 && (
              <div className="erp-command-filters" role="tablist" aria-label="Filter status">
                {resolvedFilters.map((filter) => {
                  const isSelected = activeFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      className={`erp-command-filter-pill ${isSelected ? "is-active" : ""}`}
                      onClick={() => onFilterChange && onFilterChange(filter.key)}
                    >
                      <span className="erp-command-filter-label">{filter.label}</span>
                      {filter.count !== undefined && (
                        <span className="erp-command-filter-count">{filter.count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="erp-command-right">
            {onSearchChange && (
              <div className="erp-command-search-wrap">
                <SearchInput
                  ref={searchInputRef}
                  value={search}
                  onChange={onSearchChange}
                  onClear={onSearchClear}
                  placeholder={searchPlaceholder}
                  label={searchLabel}
                  className="erp-command-search"
                />
              </div>
            )}

            {extra && <div className="erp-command-extra">{extra}</div>}

            {viewMode && onViewModeChange && (
              <div className="erp-command-viewmode" role="group" aria-label="View mode">
                <button
                  type="button"
                  className={`erp-command-icon-btn ${viewMode === "table" ? "is-active" : ""}`}
                  aria-pressed={viewMode === "table"}
                  aria-label="Table view"
                  onClick={() => onViewModeChange("table")}
                >
                  <Icon name="table" size={15} />
                </button>
                <button
                  type="button"
                  className={`erp-command-icon-btn ${viewMode === "grid" ? "is-active" : ""}`}
                  aria-pressed={viewMode === "grid"}
                  aria-label="Grid view"
                  onClick={() => onViewModeChange("grid")}
                >
                  <Icon name="layers" size={15} />
                </button>
              </div>
            )}

            {onRefresh && (
              <button
                type="button"
                className={`erp-command-icon-btn ${refreshing ? "is-busy" : ""}`}
                aria-label="Refresh list"
                disabled={refreshing}
                onClick={onRefresh}
              >
                <Icon name="refresh" size={15} className={refreshing ? "erp-spin" : ""} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
