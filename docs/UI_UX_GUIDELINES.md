# Enterprise UI/UX Design Guidelines

## 1. Design Standard & Inspiration

The Inventory Management module follows the design philosophy of world-class enterprise SaaS products:
- **Linear**: Focused workflow ergonomics, clear typographic hierarchy, keyboard accessibility.
- **Stripe**: Impeccable data presentation, high-density tabular numbers, subtle feedback states.
- **Vercel**: Minimalist restraint, crisp borders, semantic color usage.

## 2. Core Tenets

1. **Information Density with Purpose**: Enterprise operators manage thousands of SKUs and movements. Tables must support high density without visual overcrowding.
2. **Tabular Numerics**: Numerical values, quantities, serials, and currency amounts must always use `tabular-nums` alignment (`font-variant-numeric: tabular-nums`).
3. **Semantic Color System**:
   - Primary: Indigo/Blue (`#3B82F6` / `#2563EB`)
   - Success / In-Stock: Emerald (`#10B981`)
   - Warning / Low Stock: Amber (`#F59E0B`)
   - Danger / Out of Stock: Rose (`#EF4444`)
   - Reserved / Auxiliary: Violet (`#8B5CF6`)
4. **Zero Useless Decoration**: No gratuitous animations or illustrative clutter. Every badge, icon, and button serves an operational purpose.
5. **No Broken Interactions**: Every button, dropdown, search input, and filter must have a working handler or explicitly show disabled/empty states.
