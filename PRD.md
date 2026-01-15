# Planning Guide

A comprehensive validation system dashboard that provides real-time monitoring and control of the Gatekeeper validation pipeline, enabling developers to track validation runs, review gate results, and manage system configuration with precision and clarity.

**Experience Qualities**:
1. **Systematic** - Information is organized hierarchically with clear navigation patterns that mirror the validation pipeline's logical flow from runs to gates to individual validators.
2. **Technical** - The interface embraces a developer-focused aesthetic with monospace elements, precise status indicators, and detailed diagnostic information presented without unnecessary abstraction.
3. **Responsive** - Status updates, filtering, and navigation feel immediate with clear visual feedback for all interactions and state changes.

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is a full-featured dashboard with multiple interconnected views (runs list, run details, gates overview, configuration), real-time status tracking, CRUD operations, form validation, and comprehensive data visualization of validation pipeline results.

## Essential Features

### Run List View
- **Functionality**: Displays paginated list of all validation runs with filtering capabilities
- **Purpose**: Provides at-a-glance overview of validation history and current status
- **Trigger**: User navigates to Runs page or clicks sidebar navigation
- **Progression**: Load runs data → Apply status filter if selected → Display table with run data → User clicks pagination controls or row → Navigate to detail view or fetch next page
- **Success criteria**: Table loads within 500ms, pagination works correctly, status filter updates results, row click navigates to detail view

### Run Details View
- **Functionality**: Shows comprehensive validation results including gate progress, validator outcomes, and error details
- **Purpose**: Enables deep inspection of validation failures and understanding of gate progression
- **Trigger**: User clicks on run from list or navigates directly via URL
- **Progression**: Load run details → Parse gate and validator results → Display progress indicator → Show expandable gate sections → User expands gates to view validators → View evidence and error messages
- **Success criteria**: All run data displays correctly, gate progression is visually clear, validator details are accessible, evidence is readable

### New Validation Form
- **Functionality**: Creates new validation runs with configurable parameters and optional manifest
- **Purpose**: Initiates validation pipeline for specific projects and tasks
- **Trigger**: User clicks "New Validation" button
- **Progression**: Open form → User fills required fields (projectPath, taskPrompt) → Optionally configure refs and manifest → Validate inputs → Submit POST request → Show loading state → Redirect to new run details page on success
- **Success criteria**: Form validation prevents invalid submissions, manifest file entries work correctly, successful submission creates run and redirects

### Gates Overview
- **Functionality**: Displays all validation gates with their validators
- **Purpose**: Provides understanding of validation pipeline structure and gate composition
- **Trigger**: User navigates to Gates page
- **Progression**: Load gates list → Display gate cards → User clicks/expands gate → Fetch validators for that gate → Display validator list with details
- **Success criteria**: All gates display with correct metadata, validator lists load on expansion, hard block indicators are clear

### Configuration Management
- **Functionality**: Allows viewing and editing system configuration values
- **Purpose**: Enables runtime adjustment of validation system behavior
- **Trigger**: User navigates to Config page
- **Progression**: Load config items → Display in editable format → User modifies value → Clicks save → Validate input → Submit PUT request → Show success/error feedback → Update local state
- **Success criteria**: All config items are editable, type validation works, saves persist to backend, errors are handled gracefully

### Run Actions
- **Functionality**: Abort running validation or delete completed runs
- **Purpose**: Provides control over active and historical validation runs
- **Trigger**: User clicks abort/delete button on run detail or list view
- **Progression**: User clicks action button → Show confirmation dialog → User confirms → Submit POST/DELETE request → Update UI state → Show success notification
- **Success criteria**: Actions only available for appropriate run states, confirmation prevents accidents, UI updates immediately

## Edge Case Handling

- **Empty States**: Show helpful messages when no runs exist, no validators in gate, or no config items
- **Loading States**: Display skeleton loaders during data fetches to maintain layout stability
- **Error States**: Show clear error messages for failed API calls with retry options
- **Network Failures**: Handle timeout and connection errors gracefully with user-friendly messages
- **Invalid Routes**: Redirect to 404 page for non-existent run IDs or pages
- **Long Content**: Truncate long project paths and task prompts with tooltips for full text
- **Pagination Bounds**: Disable next/previous buttons appropriately at list boundaries
- **Concurrent Modifications**: Handle cases where run status changes while viewing details
- **Form Validation**: Prevent submission with invalid data and show inline error messages

## Design Direction

The design should evoke a sense of technical precision and systematic organization - like a command center or CI/CD dashboard. It should feel professional, developer-focused, and data-dense without overwhelming. The aesthetic should emphasize clarity of status, hierarchy of information, and efficient information scanning.

## Color Selection

A dark, technical color scheme that emphasizes status colors and creates visual hierarchy through contrast.

- **Primary Color**: Deep purple `oklch(0.45 0.15 285)` - Represents the system's authority and technical sophistication, used for primary actions and navigation highlights
- **Secondary Colors**: Dark slate backgrounds `oklch(0.15 0.01 240)` for cards and `oklch(0.12 0.01 240)` for page background, creating subtle depth layers
- **Accent Color**: Electric blue `oklch(0.65 0.20 240)` - High-tech highlight for interactive elements and focus states
- **Status Colors**: 
  - Success/Passed: `oklch(0.70 0.18 145)` - Clear green
  - Failed/Error: `oklch(0.62 0.22 25)` - Vibrant red
  - Warning: `oklch(0.75 0.15 85)` - Amber yellow
  - Running: `oklch(0.65 0.20 240)` - Electric blue
  - Pending: `oklch(0.55 0.05 240)` - Muted slate blue
  - Aborted: `oklch(0.45 0.03 240)` - Dark gray

**Foreground/Background Pairings**:
- Background `oklch(0.12 0.01 240)`: Foreground `oklch(0.95 0.01 240)` - Ratio 16.8:1 ✓
- Card `oklch(0.15 0.01 240)`: Foreground `oklch(0.95 0.01 240)` - Ratio 14.2:1 ✓
- Primary `oklch(0.45 0.15 285)`: White `oklch(1 0 0)` - Ratio 5.2:1 ✓
- Accent `oklch(0.65 0.20 240)`: Dark bg `oklch(0.12 0.01 240)` - Ratio 7.8:1 ✓

## Font Selection

Typefaces should convey technical precision and readability. Use JetBrains Mono for code-like elements (IDs, paths, timestamps) and Inter for UI text, creating a modern developer-tool aesthetic.

- **Typographic Hierarchy**:
  - H1 (Page Title): Inter Bold/32px/tight letter spacing - Primary page headers
  - H2 (Section): Inter Semibold/24px/normal - Gate names, card headers
  - H3 (Subsection): Inter Semibold/18px/normal - Validator names, form sections
  - Body (Primary): Inter Regular/14px/1.5 line height - General text content
  - Body (Small): Inter Regular/12px/1.4 line height - Metadata, descriptions
  - Code (IDs/Paths): JetBrains Mono Regular/13px/1.3 line height - Run IDs, file paths, technical values
  - Labels: Inter Medium/12px/uppercase/wider letter spacing - Form labels, table headers

## Animations

Animations should feel precise and purposeful like a technical system updating in real-time. Use subtle micro-interactions for state changes (hover, expand/collapse) with snappy timing (150-200ms). Status changes should have a brief highlight pulse (300ms) to draw attention. Page transitions should be minimal (fade 200ms) to maintain focus on data. Avoid decorative animations that distract from information density.

## Component Selection

- **Components**:
  - Sidebar: Navigation with route highlighting and icon + label structure
  - Table: Run list with sortable columns, hover states, and clickable rows
  - Card: Gate overview cards and config item cards with elevation on hover
  - Badge: Status indicators with color coding (passed/failed/running/pending/aborted/warning/skipped)
  - Button: Primary actions (New Validation), secondary actions (Abort, Delete), icon buttons
  - Dialog: Confirmation dialogs for destructive actions (abort, delete)
  - Form: Input, Textarea, Checkbox, Select for validation form
  - Collapsible/Accordion: Expandable gate sections and task prompt display
  - Tabs: Could be used for switching between different config categories
  - Progress: Visual gate progression indicator (stepper-style)
  - Skeleton: Loading placeholders for tables and cards
  - Tooltip: Hover details for truncated text and status explanations
  - Alert: Error messages and success notifications

- **Customizations**:
  - Custom progress stepper for gate visualization (0-3) showing current gate with connecting lines
  - Custom status badge variants for all run/gate/validator states with icons
  - Custom table row hover with subtle elevation and border highlight
  - Syntax-highlighted code blocks for evidence display using monospace font

- **States**:
  - Buttons: Default has subtle border, hover brightens and lifts slightly, active depresses, disabled shows reduced opacity
  - Table rows: Default with separator, hover shows background tint and border, active/selected shows accent border
  - Cards: Default with dark background, hover lifts with shadow, expandable cards show chevron rotation
  - Form inputs: Default with border, focus shows accent border and ring, error shows red border, success shows green border
  - Status badges: Solid colored background with matching text, appropriate icon prefix

- **Icon Selection**:
  - List/PlayCircle - Runs navigation
  - ShieldCheck/ShieldWarning - Gates navigation  
  - Gear/Wrench - Config navigation
  - Play/Rocket - New validation action
  - Stop/XCircle - Abort action
  - Trash - Delete action
  - CheckCircle - Passed status
  - XCircle - Failed status
  - Clock/Hourglass - Pending/Running status
  - Warning - Warning status
  - Minus - Skipped status
  - ChevronDown/ChevronRight - Expand/collapse
  - CaretLeft/CaretRight - Pagination
  - FunnelSimple - Filter

- **Spacing**:
  - Page padding: p-6 to p-8 for main content area
  - Card padding: p-4 to p-6 depending on card size
  - Section gaps: gap-6 for major sections, gap-4 for related elements
  - Table cell padding: px-4 py-3 for comfortable data scanning
  - Form field spacing: gap-4 between fields, gap-2 for label-input pairs
  - Sidebar item padding: px-4 py-2 for touch targets

- **Mobile**:
  - Sidebar collapses to icon-only on mobile with expandable overlay
  - Table converts to stacked cards on mobile with key fields visible
  - Horizontal gate progress stepper becomes vertical on narrow screens
  - Form fields stack vertically with full width
  - Reduce page padding to p-4 on mobile
  - Action buttons group into dropdown menu on small screens
  - Collapsible sections start collapsed on mobile to reduce scrolling
