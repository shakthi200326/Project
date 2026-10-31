/**
 * The ONE ERP design system, as one import.
 *
 * Modules import from here rather than reaching into `components/`, so a
 * component can be split, renamed or rebuilt without every screen in the
 * product needing an edit.
 */

export { colors } from "./tokens/colors";
export { typography } from "./tokens/typography";
export { spacing } from "./tokens/spacing";

export { describeError } from "./errors";
export { LinkComponentProvider } from "./linking";

export {
  EMPTY_MARK,
  formatBytes,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  toDate,
  toISO,
  toNumber,
} from "./formatting";

/* Actions */
export { default as ActionMenu } from "./components/ActionMenu";
export { default as BulkActionBar } from "./components/BulkActionBar";
export { default as Button } from "./components/Button";
export { default as CommandBar } from "./components/CommandBar";
export { default as IconButton } from "./components/IconButton";

/* Icons */
export { default as Icon } from "./components/Icon";
export { ICON_NAMES } from "./iconPaths";
export { default as PageActions } from "./components/PageActions";

/* Structure */
export { default as Card } from "./components/Card";
export { default as Drawer } from "./components/Drawer";
export { default as Page } from "./components/Page";
export { default as PageHeader } from "./components/PageHeader";
export { default as SectionCard } from "./components/SectionCard";

/* Navigation */
export { default as BackLink } from "./components/BackLink";
export { default as Breadcrumbs } from "./components/Breadcrumbs";
export { default as Pagination } from "./components/Pagination";
export { default as Tabs } from "./components/Tabs";
export { default as Tooltip } from "./components/Tooltip";

/* Forms */
export { default as Checkbox } from "./components/Checkbox";
export { default as FormField } from "./components/FormField";
export { default as FormSection } from "./components/FormSection";
export { default as Input } from "./components/Input";
export { default as RadioGroup } from "./components/RadioGroup";
export { default as SearchInput } from "./components/SearchInput";
export { default as SearchSelect } from "./components/SearchSelect";
export { default as Select } from "./components/Select";
export { default as Switch } from "./components/Switch";
export { default as Textarea } from "./components/Textarea";

/* Data display */
export { default as Badge } from "./components/Badge";
export { default as DateDisplay } from "./components/DateDisplay";
export { default as DescriptionList } from "./components/DescriptionList";
export { default as Field } from "./components/Field";
export { default as FilterBar } from "./components/FilterBar";
export { default as ListToolbar } from "./components/ListToolbar";
export { default as NumberDisplay } from "./components/NumberDisplay";

/* Dashboard figures. Shared by the platform and tenant dashboards so the
   two read as one product; see MetricStrip.jsx for how a band is built.

   `DashboardKit` is the newer and fuller half of that: sections, figure
   rows, panels, severity marks, meters and the empty states, with
   `dashboard.css` beside it. New dashboard work composes those. */
export {
  DashboardGrid,
  DashboardPanel,
  DashboardSection,
  DataRow,
  DataRows,
  Delta,
  PanelEmpty,
  Stat,
  StatRow,
  UsageMeter,
} from "./components/DashboardKit";
export { default as Composition } from "./components/Composition";
export { default as Metric } from "./components/Metric";
export { default as MetricStrip } from "./components/MetricStrip";
export { default as RelativeTime } from "./components/RelativeTime";
export { default as StatCard } from "./components/StatCard";
export { default as StatGrid } from "./components/StatGrid";
export { default as Table } from "./components/Table";

/* States and feedback */
export { default as Alert } from "./components/Alert";
export { default as ConfirmDialog } from "./components/ConfirmDialog";
export { default as EmptyState } from "./components/EmptyState";
export { default as ErrorState } from "./components/ErrorState";
export { default as LoadingState } from "./components/LoadingState";
export { default as Modal } from "./components/Modal";
export { default as NotFoundState } from "./components/NotFoundState";
export { default as Skeleton } from "./components/Skeleton";
export { default as Spinner } from "./components/Spinner";
export { default as TableLoader } from "./components/TableLoader";
export { default as IconAction, RowActions } from "./components/IconAction";
export { ACTION_ICONS } from "./actionIcons";
export { default as Toast } from "./components/Toast";

/* Order matters: the custom properties have to exist before any rule reads
   them, and the document reset before any component sits on top of it.

   `theme.css` sits directly after the tokens it overrides, and before the
   component rules that read them -- it declares no component styles of its
   own, only the same custom properties under `[data-erp-mode]` and
   `[data-erp-color]`.

   `forms.css` is the one component area with a file of its own. Every rule
   in it used to live in `design-system.css`, scattered between the tables
   and the toasts -- the input at line 72 and the textarea that has to
   match it at line 1591, which is how the two came to disagree about what
   focus looks like. A form is worth being able to read in one sitting. */
import "./tokens.css";
import "./theme.css";
import "./base.css";
import "./design-system.css";
import "./forms.css";
/* The dashboard language, for the same reason `forms.css` is its own file:
   the platform console and the tenant workspace are two screens that have
   to look like one product, and the only way that holds is if the section
   headers, figure rows, panels and severity marks they share are written
   once rather than twice. */
import "./dashboard.css";
import "./tailwind.css";