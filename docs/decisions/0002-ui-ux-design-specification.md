# 2. UI/UX Architecture and Interaction Specification

Date: 2026-08-24
Status: Accepted

## Context

Detailers require an efficient, reliable, and high-clarity desktop user interface to inspect AHU engineering specifications, resolve missing/unconfirmed facts, manage Special Quotes (SQs), check off multi-skid verification rules, and generate certified Excel deliverables without cognitive fatigue or Excel formatting bugs.

## Decisions

1. **Application Shell & Theme Engine**:
   - Left navigation sidebar showing 'General Unit' and dynamic Shipping Skid tabs (`Skid 1`, `Skid 2`, etc.) with live completion counters and warning badges.
   - Top action bar housing project persistence status (.dvl state), pinned Rule Pack badge, and primary actions (Open XML, Open .dvl, Save, Export .xlsx, Settings).
   - Multi-theme support with a user preference toggle: **System Default**, **Dark Theme** (slate/zinc high contrast), or **Light Theme**.
   - Collapsible sidebar rail for flexible window sizing (1280x720 up to 4K multi-monitor).

2. **General Unit Interface**:
   - Categorized card grid grouping specifications: 'Order & Identity', 'Geometry & Casing', 'Materials & Gauges', and 'Ratings & Options'.
   - Provenance status indicators per field: `Auto: Config.xml` (with XPath inspection), `Overridden` (with 1-click revert to XML), and `Manual Entry`.

3. **Special Quotes (SQ) & Deviation Manager**:
   - Inline dynamic SQ manager on the General Unit tab with drag-and-drop reordering, active slot counter (`X / 22 slots used`), and optional tagging to specific Skids or Rules.
   - Linked SQs automatically display contextual badges on the tagged Skid headers and Rule cards.
   - Automatically maps up to 22 entries into rows 4–25 (columns G & H) of the official `Verification List` sheet at export.

4. **Skid-Centric Verification View**:
   - Dynamic Skid tabs showing skid boundary metadata (detected segments, internals, base type, weight status).
   - Grouped collapsible accordions for component categories (Base, Housing, Drain Pan, Fans, Filters, Internals, Reconnects) with category progress bars.
   - Interactive rule cards with 3-state applicability (`Applicable`, `Not Applicable`, `Needs Input`), specification references, expandable comment fields, and evaluated fact traces.
   - View mode toggle: Rich Card View vs. Dense Spreadsheet Grid for rapid keyboard-driven review.

5. **Fact Resolution Model**:
   - Dual resolution pathways:
     - **Inline Popovers**: Quick-resolve buttons directly on the rule card or skid banner where an unknown fact or unconfirmed code is required.
     - **Global Resolution Center**: Consolidated modal dialog opened via the header/sidebar warning indicator to review and batch-resolve all unit-wide pending facts.

6. **Export Pre-Flight & Delivery Workflow**:
   - Comprehensive Pre-Flight Modal launched from "Export (.xlsx)":
     - Readiness audit with clickable jump links to any incomplete checks or unconfirmed facts.
     - **Final Verification Deliverable**: 1-click generation when 100% checks and facts are satisfied.
     - **Draft Export**: Watermarked/flagged export allowed with confirmation.
     - Auto-generated default filename pattern: `<JobName>_<COM>_Detailing_Verification_List.xlsx`.
     - Post-export instant actions: 'Open in Excel' and 'Show in Explorer'.

7. **Productivity & Keyboard Navigation Suite**:
   - Global omni-search (`Ctrl+K`) for instant filtering across rules, specs, and SQs.
   - Full keyboard navigation: `Space` (Toggle Check), `N` (Mark N/A), `C` (Focus Comment), `Ctrl+S` (Save Project), `Ctrl+E` (Export Pre-Flight), `Tab`/`Shift+Tab` (Focus navigation).
   - Instant status filter chips: `All`, `Incomplete`, `Needs Input`, `Applicable`, `Complete`.

## Consequences

- Delivers a streamlined, high-productivity interface purpose-built for AHU engineering workflows.
- Eliminates guesswork by surfacing fact provenance and rule evaluation logic transparently.
- Protects output data integrity through proactive pre-flight validation.
