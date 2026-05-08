# PymesHub Design System

## Overview
All pages in PymesHub follow a consistent design pattern using the `PageTemplate` component.

## Components

### PageTemplate
Main layout wrapper for all pages.

```tsx
import { PageTemplate, SectionCard, MetricCard } from "@/components/layout/page-template";

export default function MyPage() {
  return (
    <PageTemplate
      title="Page Title"
      description="Optional subtitle"
      actions={[
        { label: "New Item", href: "/path", variant: "primary" },
        { label: "Filter", onClick: () => {} },
      ]}
      showSearch={true}
    >
      {/* Page content here */}
    </PageTemplate>
  );
}
```

### SectionCard
Container for related content sections.

```tsx
<SectionCard
  title="Section Title"
  description="Optional description"
  linkTo="/full-page"
  linkLabel="Ver todos"
  loading={isLoading}
  empty={items.length === 0}
>
  <div>
    {/* Content here */}
  </div>
</SectionCard>
```

### MetricCard
Display key metrics with optional trend indicators.

```tsx
<MetricCard
  label="Revenue"
  value={2450000}
  currency="€"
  trend={18.6}
  trendLabel="vs. mes anterior"
  icon={TrendingUp}
  color="blue"
/>
```

## Color Palette

- **Primary Blue**: Interactive elements, links
- **Orange**: Warnings, alerts
- **Red**: Critical, errors
- **Purple**: Secondary actions
- **Green**: Success, positive trends
- **Gray**: Neutral, backgrounds

## Typography

- **Page Title**: 2xl font-bold text-gray-900
- **Section Title**: font-semibold text-gray-900
- **Body Text**: text-sm text-gray-600
- **Small Text**: text-xs text-gray-500

## Layout Patterns

### Single Column
```tsx
<PageTemplate title="Contacts">
  <SectionCard title="All Contacts">
    {/* List content */}
  </SectionCard>
</PageTemplate>
```

### Two Column
```tsx
<PageTemplate title="Dashboard">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <SectionCard title="Section 1" />
    <SectionCard title="Section 2" />
  </div>
</PageTemplate>
```

### Three Column
```tsx
<PageTemplate title="Dashboard">
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <SectionCard title="Section 1" />
    <SectionCard title="Section 2" />
    <SectionCard title="Section 3" />
  </div>
</PageTemplate>
```

## Standard Page Sections

All pages should include:

1. **Header** (via PageTemplate)
   - Page title
   - Description/subtitle
   - Search (optional)
   - Action buttons

2. **Main Content**
   - Metrics cards (if applicable)
   - Data sections (cards)
   - Lists/tables (with row hover effects)

3. **Empty State**
   - SectionCard handles this with `empty` prop

4. **Loading State**
   - SectionCard handles this with `loading` prop

## Page Examples

### Dashboard
- 5 metric cards in a row
- 3-column grid with messages, tasks, pipeline
- Quick action buttons at bottom

### Inbox
- Metrics: Unread, New, Pending
- Channel tabs
- Message list
- Conversation detail (side panel or modal)

### Contacts
- Metrics: Total, Active, Recent
- Search and filter bar
- Contact list with avatars
- Contact detail (side panel or modal)

### Invoices
- Metrics: Total, Overdue, Pending
- Status tabs
- Invoice list with amounts
- Quick action: New invoice

### Tasks
- Metrics: Total, Overdue, Completed
- Priority tabs
- Task list with due dates
- Quick action: New task

### Pipeline
- Metrics: Total deals, Total value
- Pipeline stages with drag-drop
- Deal cards in stages
- Quick action: New deal

## Responsive Breakpoints

- **Mobile**: Single column, stacked metrics
- **Tablet**: Two columns, 2-3 metrics
- **Desktop**: Full layout, 5 metrics, 3 columns

## Spacing & Padding

- Container: `px-6 py-8` (max-w-7xl)
- Card: `p-6` (inner content)
- Section header: `px-6 py-4` with border-b
- Row: `px-6 py-3` with hover:bg-gray-50
- Gap between cards: `gap-6` (main grid), `gap-4` (metric grid)

## Interactive States

- **Hover**: `hover:bg-gray-50` for rows, `hover:shadow-lg` for cards
- **Focus**: `focus:outline-none focus:ring-2 focus:ring-blue-500` for inputs
- **Loading**: Skeleton loaders with animate-pulse
- **Empty**: Centered message with icon option

## API Integration

All pages should:

1. Use `useQuery` for data fetching
2. Pass `loading` state to SectionCard
3. Pass `empty` state when data is empty
4. Use `useToast` for user feedback
5. Implement error handling

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ["endpoint"],
  queryFn: api.fetchData,
});

return (
  <SectionCard loading={isLoading} empty={data?.length === 0}>
    {/* List items */}
  </SectionCard>
);
```
