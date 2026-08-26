# 5. Dynamic OpenXML Deliverable Synthesis and Scratchpad Sheet Pruning

Date: 2026-08-26
Status: Accepted

## Context

The physical Excel verification deliverable template (`Detailing Verification List.xlsx`) originally contained 12 worksheets (including 8 category scratchpads: `Base`, `Drain Pan`, `Housing`, `Paperwork`, `Internal`, `Coil Panels`, `Reconnects`, and `MOM`) and 23 cross-sheet formula chains on `Check Information` (e.g. `='Drain Pan'!F1`).

In actual AHU fabrication, most units do not include every category (for example, units without cooling or moisture condensation omit a `Drain Pan`, and units without split shipping skids omit `Reconnects`). Retaining empty, unused category scratchpad worksheets clutters the checker workbook and generates dead tabs. Furthermore, writing checks to a static 200+ row block on `Verification List` with hundreds of inapplicable checks marked as "N/A" impairs readability and reviewer efficiency.

## Decisions

1. **Dynamic Category Sheet Pruning**:
   - `OpenXmlTemplatePatcher` dynamically determines active category worksheets by inspecting all `Applicable` checklist instances in the current project.
   - Any category worksheet among the 8 scratchpad tabs with zero applicable checks is cleanly deleted from the OpenXML package (`WorkbookPart.DeletePart` and `Sheet.Remove`).
   - Core tabs (`Revision List`, `Verification List`, `Check Information`, `Comments`) are permanent and never deleted.

2. **Formula Adaptation Engine on `Check Information`**:
   - Deleting worksheet parts leaves dangling formula references in Excel, which would otherwise evaluate to `#REF!` errors.
   - `AdaptCheckInformationFormulas` scans cells `B8..B15` and `C8..C15` on `Check Information`. If the referenced category worksheet was pruned, its formula cell is cleared and replaced with a static numeric `0`.
   - Dynamic formula sums `B19` (`H1` sum across active categories) and `B20` (`J1` sum across active Base/Housing/Paperwork categories) are dynamically rewritten to sum only currently active category sheets.
   - The OpenXML `CalculationChainPart` is deleted to force Microsoft Excel to recompute all dependency graphs cleanly upon opening.

3. **Dynamic Skid-Grouped Verification Rows**:
   - Static rows $\ge 26$ in the template are cleared.
   - Verification checks are dynamically rendered into structured sections:
     - Section 1: `=== GENERAL UNIT VERIFICATIONS ===` (grouped by category subheaders: Base, Housing, Knockdown, UTL, Paperwork, MOM).
     - Section 2..N: `=== SHIPPING SKID X: [Skid Name] ===` (grouped by Skid Segments and Internals).
   - Only applicable checks are rendered, each styled with category subheaders, alternating zebra striping, check status indicators, and detailer initials.

## Consequences

- Deliverable Excel workbooks are concise, clean, and contain only sheets and checks relevant to the specific AHU configuration.
- Eliminates all `#REF!` formula errors on `Check Information`.
- Reviewers and checkers receive a readable, skid-organized verification list directly aligned with physical unit assembly.
