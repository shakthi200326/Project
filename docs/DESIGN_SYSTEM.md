# Central Design System Specification

## 1. Design Tokens

All components consume standardized CSS custom properties defined in `shared/frontend/ui-kit/tokens/`:
- `colors.css`: Semantic color mappings for light and dark modes.
- `typography.css`: Type scale (12px caption to 24px page headers).
- `spacing.css`: 4px base grid (`var(--space-1)` = 4px to `var(--space-12)` = 48px).
- `radius.css`: Border radius scale (sm: 4px, md: 6px, lg: 8px, full: 9999px).
- `shadows.css`: Elevation shadows (sm, md, lg, xl).

## 2. Shared Component Catalogue

Located in `shared/frontend/ui-kit/components/`:
- **Buttons**: `Button`, `IconButton`, `IconAction`, `ActionMenu`
- **Data Tables**: `Table`, `TableLoader`, `Pagination`, `BulkActionBar`
- **Forms**: `Input`, `Select`, `SearchSelect`, `Checkbox`, `RadioGroup`, `Switch`, `Textarea`, `FormField`, `FormSection`
- **Navigation**: `Breadcrumbs`, `Tabs`, `CommandBar`, `BackLink`
- **Feedback & Overlays**: `Modal`, `Drawer`, `ConfirmDialog`, `Toast`, `Alert`, `Tooltip`
- **KPI & Analytics**: `StatCard`, `StatGrid`, `Metric`, `MetricStrip`
- **States**: `EmptyState`, `ErrorState`, `LoadingState`, `Skeleton`, `Spinner`

## 3. Dark Theme Implementation

Dark mode is first-class, not a computed inversion:
- Controlled via `data-theme="dark"` on `document.documentElement` or `.dark` class.
- Backgrounds use deep slate/zinc tones (`#09090b`, `#18181b`).
- Borders maintain subtle contrast (`#27272a`).
- Text uses high contrast (`#f4f4f5` primary, `#a1a1aa` secondary).

