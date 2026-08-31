# Consolidated UI/UX Findings

## Executive Summary

AHU Detailing Verification already feels like a purpose-built engineering application rather than a generic SaaS skin. Its best screens respect expert density: segment setup, unit/skid verification tables, provenance, filters, keyboard hints, and export preflight all put real work ahead of decoration. The dark industrial visual language is coherent, and the compact sidebar shows that the product understands how valuable horizontal space is.

The highest-risk problems are not aesthetic. They are failures of state trust and keyboard/modal behavior. The Facts center says everything is confirmed while the shell says 15 inputs are needed. Ctrl+K opens search without focusing it. Multiple modal surfaces leave UI Automation focus on the document and are not exposed as dialogs. Config.xml selection returns to Home without any visible outcome. Those four issues should be treated as release-quality work before visual polish.

At narrow desktop width the app survives, but it compresses and clips rather than deliberately reflowing. Collapsing the sidebar helps a lot; the header and verification grids still need a clear responsive priority model. The interface also carries a moderate amount of generated-looking residue—nested cards, repeated pills, metric tiles, and implementation-heavy copy—but the underlying information architecture is strong enough that restraint, not redesign, is the right move.

## Top 10 Issues

### 1. P1 — Facts reports success while the project reports unresolved inputs

- **Finding:** The Facts center declares “All Facts Confirmed!” and says all engineering/order values are authoritative while the shell simultaneously shows 15 inputs needed and each skid says checks need fact confirmation.
- **Evidence:** [Facts contradiction](screenshots/08-facts-contradictory-all-confirmed.png).
- **Impact:** Detailers cannot trust readiness, export state, or the meaning of “confirmed.” A false-success state is more damaging than an incomplete state because it invites premature handoff.
- **Recommendation:** Establish one readiness model with distinct counts for missing facts, non-authoritative values, and verification checks blocked by facts. Derive every surface from that model and link the success state to the same predicate used by preflight.
- **Confidence:** High.

### 2. P1 — Ctrl+K search requires a mouse click before typing

- **Finding:** Ctrl+K opened global search but left focus on the root document. Typing `seismic` produced nothing until the input was clicked.
- **Evidence:** [Search after manual focus](screenshots/07-global-search-seismic.png); interaction recorded in [the matrix](interaction-matrix.md).
- **Impact:** The advertised keyboard shortcut fails its core promise and interrupts fast expert work. Keyboard-only and assistive-technology users may perceive search as broken.
- **Recommendation:** On open, focus and select the search input; trap Tab within the surface; return focus to the invoking control on Escape/close. Add a keyboard integration test for Ctrl+K → type → results → Escape.
- **Confidence:** High.

### 3. P1 — Modal semantics and focus management are unreliable

- **Finding:** Manual setup, Settings, Facts, Search, Preflight, and Project Identity appeared visually modal, but UI Automation exposed them under the root document rather than as dialogs. Opening Project Identity and pressing Tab left focus on the document. Background content remained in the accessibility tree.
- **Evidence:** [Project Identity](screenshots/17-project-identity-wide.jpg), [Settings](screenshots/14-settings-top-wide.jpg), plus repeat UI Automation observations.
- **Impact:** Screen-reader context, reading order, keyboard entry, and focus return become unpredictable. Users can lose their place or interact with content they cannot see.
- **Recommendation:** Use semantic dialogs (`role="dialog"`, accessible name/description, `aria-modal="true"`), focus a deliberate first control, contain focus, make the background inert, and restore focus on close. Test every modal with keyboard and Windows Narrator/NVDA.
- **Confidence:** High.

### 4. P1 — Config.xml import has no visible outcome in the tested path

- **Finding:** Selecting the repository Config.xml through the real Windows picker returned to Home with no project, progress, success, or error message.
- **Evidence:** Reproduction recorded in [the interaction matrix](interaction-matrix.md). No screenshot can show absence better than the unchanged Home state.
- **Impact:** Users cannot distinguish an unsupported file, a slow import, a parser failure, or a missed click; retrying risks duplicate effort and support calls.
- **Recommendation:** Enter an explicit importing state, then show either the loaded project or a durable error with filename, reason, and next action. Preserve the selected path in diagnostics. Do not silently return to the entry screen.
- **Confidence:** High for feedback failure; low for underlying cause.

### 5. P2 — Narrow layouts compress instead of prioritizing

- **Finding:** At 1086 × 1032 with the full sidebar, header labels disappeared, project identity truncated, rule IDs wrapped, and verification columns overflowed horizontally. Compact navigation improved the situation but did not resolve grid compression.
- **Evidence:** [Expanded narrow state](screenshots/11-skid-verification-narrow.jpg) and [collapsed narrow state](screenshots/12-skid-verification-narrow-collapsed.jpg).
- **Impact:** Laptop, split-screen, and scaled-display users spend attention on panning and decoding icons instead of checking work.
- **Recommendation:** Auto-collapse the sidebar below a measured breakpoint; prioritize project name, search, save, facts, and export; move secondary actions into an overflow menu; define sticky essential columns and a detail drawer for comments/references rather than shrinking every column.
- **Confidence:** High.

### 6. P2 — Home hierarchy overweights an old autosave

- **Finding:** The previous-session card is the strongest element on Home even when stale, while manual setup/upload are equally fundamental entry routes. Technical footer copy competes with user guidance.
- **Evidence:** [Home](screenshots/01-home-autosave-wide.png).
- **Impact:** A detailer may resume the wrong job or hesitate before starting the intended workflow.
- **Recommendation:** Show autosave age, project identity, and an explicit discard/manage affordance. Reduce its emphasis after a staleness threshold. Replace engine/version marketing with one short line about accepted file types and recovery behavior.
- **Confidence:** High.

### 7. P2 — Verification grids truncate the information users are verifying

- **Finding:** Long descriptions, references, project names, and comments are clipped even at the main 1426-pixel width; the sidebar itself exposes a horizontal scrollbar.
- **Evidence:** [General Unit](screenshots/06-populated-general-unit-wide.png) and [Skid verification](screenshots/10-skid-verification-wide.jpg).
- **Impact:** Users must expand, hover, or horizontally scroll to read the exact requirement, increasing omission and mis-check risk.
- **Recommendation:** Allocate width by task importance: description first, check/N/A fixed, comments flexible, secondary metadata in expandable detail. Avoid horizontal scrolling in navigation. Offer a persisted density setting, but do not make “dense” mean clipped.
- **Confidence:** High.

### 8. P2 — User copy leaks markup and implementation terms

- **Finding:** `$N \\ge 1$`, `StructuralSteel`, “normalized XML,” “domain facts,” “AST verification rules,” “OpenXML deliverables,” and “Download .dvl” appear in user-facing flows.
- **Evidence:** [Skid setup](screenshots/03-manual-setup-skids-wide.png), [setup review](screenshots/05-manual-setup-review-wide.png), and [preflight](screenshots/09-preflight-incomplete-wide.png).
- **Impact:** The product feels unfinished and forces domain users to translate software internals.
- **Recommendation:** Replace markup with plain text (“one or more”), format enum values for display, describe outcomes (“build the verification checklist”), and use desktop verbs (“Save project”). Add a user-copy review to release checks.
- **Confidence:** High.

### 9. P2 — Secondary text and metadata are too subdued

- **Finding:** References, helper text, dimensions, subtitles, and labels use small, low-emphasis gray/monospace text against dark surfaces. The product labels Dark as “High contrast,” but this was not substantiated with measured ratios.
- **Evidence:** Visible throughout [Skid verification](screenshots/10-skid-verification-wide.jpg), [Settings](screenshots/14-settings-top-wide.jpg), and [Home](screenshots/01-home-autosave-wide.png).
- **Impact:** Extended scanning becomes tiring and users with low vision may miss provenance or context needed for a correct decision.
- **Recommendation:** Measure token contrast against WCAG 2.2 AA, raise metadata contrast/size, reserve the faintest token for nonessential decoration, and test dark/light themes at 125% and 150% Windows scaling.
- **Confidence:** Medium until token-level contrast is measured.

### 10. P3 — Card, pill, and metric-tile repetition weakens hierarchy

- **Finding:** Many sections wrap already-grouped content in another bordered card; feature state, shipping sequence, mapped segments, status, and summary values often become pills or tiles.
- **Evidence:** [Setup review](screenshots/05-manual-setup-review-wide.png), [General Unit](screenshots/06-populated-general-unit-wide.png), and [Unit Verifications](screenshots/13-unit-verifications-wide-collapsed.jpg).
- **Impact:** Everything asks for equal attention, making the interface look more generated and less editorially deliberate.
- **Recommendation:** Keep badges only for compact status or true category encoding. Use plain rows, definition lists, dividers, and typography for stable attributes. Remove one container layer wherever the page background already establishes the group.
- **Confidence:** High.

## Accessibility Findings

### Critical

No P0 accessibility blocker was proven in this pass. Complete screen-reader and Windows scaling certification remains outstanding.

### Important

- **Keyboard search:** Ctrl+K does not focus the input. This is a concrete keyboard failure, not a theoretical concern.
- **Modal entry and containment:** New modal surfaces leave UI Automation focus on the root document, lack an exposed dialog role, and retain background content in the tree.
- **Focus visibility/context:** Some clicks produced a visible row outline, but UI Automation continued to report document focus. Focus should be both visually and programmatically reliable.
- **Contrast/size risk:** Supporting metadata is small and low-emphasis. Measure it across both themes rather than relying on the “high contrast” label.
- **Responsive accessibility:** Narrow width converts text actions into icons and wraps identifiers; icon labels were generally present in UI Automation, which is good, but visual discoverability drops.

### Minor

- Modal subtitles truncate at the normal review width, removing context for Settings, Facts, and Project Identity.
- Escape closed most focused modals and returned visual focus in the mouse-focused search/facts flows, but it did not dismiss the manual setup wizard during the tested state.
- Keyboard hints are visible and useful, but they should not be the only documentation of interaction and must be backed by real focus behavior.

### What is already working

- The shell exposes complementary navigation, header, main content, headings, tables, rows, and column headers to UI Automation.
- Most icon-only actions have descriptive accessible names/tooltips.
- Tables preserve domain relationships instead of reducing everything to anonymous cards.
- Escape worked for several modal closes, and the preflight Jump action delivered a meaningful destination.

## Information Design Findings

- The core model is sound: project → unit → skids → grouped verifications → facts/provenance → preflight/export.
- Sidebar counts and warnings are valuable, but status vocabulary is not reconciled. “Input needed,” “fact confirmation,” “confirmed,” “applicable,” “verified,” and “pending” need a documented relationship visible in the interface.
- Mapped segments are useful context above both unit and skid checks. They should stay, with restrained color and fewer decorative borders.
- Provenance/reference text belongs close to each rule; its current low contrast makes the right information harder to use.
- Home is an entry decision, not a dashboard. It needs clear recency and file-type guidance more than an engine-quality claim.
- Preflight is the right place for summary tiles because the user is making a release decision; similar tile treatment elsewhere should be more selective.

## Workflow Findings

### Strong paths

- Manual setup is a credible four-step workflow with good domain grouping.
- Resuming autosave is immediate and restores meaningful work state.
- Verification filters, grouped tables, comments, check/N/A controls, and reference expansion support real review work.
- Export preflight explains why final export is blocked while allowing a draft, and Jump reduces recovery cost.
- Compact sidebar mode is effective and preserves position/counts.

### Friction and failure paths

- Config.xml import silently returns to Home in this build.
- Search advertises keyboard speed but requires mouse focus.
- Facts can report false readiness.
- Tall settings require nested scrolling; the rule-editor launch produced no surfaced result or error in the review environment.
- Several modals look complete visually but do not establish programmatic modal context.
- Save/export final file generation was intentionally not completed, so destination confirmation and overwrite/error states remain unverified.

## Responsive Findings

- **1920 × 1032:** Content has room, but the verification canvas can become overly wide; max-width or purposeful column growth would improve scan length.
- **1426 × 893:** The application is broadly effective, though header identity and some tables already truncate; sidebar horizontal overflow is visible.
- **1086 × 1032, sidebar expanded:** Usable but cramped. Header actions become icon-only, the project title truncates, identifiers wrap, and grids overflow.
- **1086 × 1032, sidebar collapsed:** Materially better and the best tested narrow configuration. The remaining problem is column policy, not navigation width.
- **Zoom/scaling:** Two Ctrl++ inputs produced no visible change in the WebView host. This is not evidence that Windows 125%/150% scaling works; it is an explicit release-test gap.

Recommended responsive behavior: auto-collapse navigation below the grid's usable breakpoint; preserve labels for destructive/commit actions; put secondary actions in overflow; keep requirement/check state visible; move comments, provenance, and AST detail into a row drawer at constrained widths.

## Visual System Findings

### Typography

- The main sans-serif plus monospace metadata pairing suits technical work.
- Metadata sizes and contrast are pushed too low; compactness is being purchased with readability.
- Uppercase section labels work as landmarks but are overused inside cards.

### Spacing and density

- Verification rows use vertical space efficiently and maintain rhythm.
- Forms have comfortable grouping.
- Nested cards create excess inset and border repetition; the same spacing token appears to serve both page sections and small status groups.

### Color

- Dark navy/zinc surfaces with blue, green, amber, and purple accents form a recognizable product character.
- Semantic green/amber/red generally matches state meaning.
- Segment colors are useful but numerous; their saturation should not outrank pending/error state.
- Light mode applies, but the captured Settings state mixes light fields/cards with a dark modal shell and needs its own coherence pass.

### Hierarchy

- Page headings, progress, filters, and group headers are usually clear.
- Repeated pills and outlined containers flatten stable data, actionable warnings, and navigation into similar visual objects.
- Preflight metrics earn prominence; setup review and feature attributes need quieter treatment.

## AI-Slop Audit

The product is **not** generic AI slop overall. It has domain-shaped information, technical density, real references, keyboard affordances, meaningful filters, and an industrial character. There is no gratuitous glassmorphism, giant hero treatment, gradient headline, or empty marketing dashboard.

The generated-looking residue is moderate:

- container inside container inside container;
- nearly every compact value becoming a pill;
- metric cards used beyond true decision summaries;
- implementation-heavy copy presented as reassurance;
- repetitive icon-plus-uppercase-label section headers;
- feature states expressed as equal-weight cards instead of a calm specification list.

The remedy is subtraction. Preserve the information and tables; remove decorative boundaries, format enum/copy output for humans, and let typography establish more of the hierarchy.

## What Should Stay

- The industrial dark theme and technical personality.
- Dense, real tables for verifications and materials.
- Sidebar model with per-skid progress/warnings and an effective compact mode.
- Progressive four-step manual setup.
- Mapped-segment context above verification work.
- Reference/provenance adjacent to each check.
- Filters and visible keyboard legend.
- Preflight counts, incomplete-item list, Draft option, and working Jump action.
- Autosave/crash-recovery concept and explicit destructive-action styling.
- System/Dark/Light theme options.
- Descriptive accessible names on icon actions and semantic table exposure.

## Recommended Improvements

### Immediate

1. Reconcile Facts, sidebar warnings, and preflight against one readiness predicate.
2. Fix Ctrl+K focus; implement modal role, inert background, focus trap, Escape behavior, and focus return across every modal.
3. Give Config.xml import and Rule Editor launch explicit pending/success/error feedback.
4. Replace literal markup, enum strings, implementation terminology, and browser verbs in user copy.
5. Add focused integration tests for these four workflows before visual refactoring.

### Near-Term

1. Define a responsive priority model for header, sidebar, and verification columns; auto-collapse navigation at constrained widths.
2. Measure and correct dark/light contrast tokens; certify 100%, 125%, and 150% Windows scaling with keyboard and a screen reader.
3. Rework Home around recency and entry decisions rather than technical claims.
4. Make description the primary grid column and shift provenance/comments/detail into an expandable panel where width is constrained.
5. Keep modal titles/subtitles readable without clipping and avoid nested scroll traps.

### Polish

1. Remove one border/container layer across feature summaries, setup review, and settings groups.
2. Reserve pills for actionable status and real categorical encoding.
3. Persist the user's density/sidebar preference and consider context-aware compact mode.
4. Tighten light-theme surface ownership so modal, fields, cards, and backdrop belong to one system.
5. Standardize desktop verbs: Open, Save, Save As, Export, and Browse.

## Suggested Design Principles

1. **Trust one readiness model.** Every warning, success state, and export gate must agree.
2. **The requirement gets the width.** Verification text outranks decorative metadata and secondary actions.
3. **Keyboard promises are contracts.** A displayed shortcut must complete the first useful action without a mouse.
4. **Modal means modal everywhere.** Visual layering, focus, UI Automation, Escape, and return behavior must match.
5. **Use density for work, not for chrome.** Keep rows and tables compact; remove redundant cards and borders.
6. **Show domain language, hide implementation language.** Detailers need facts, skids, rules, and deliverables—not AST/XML plumbing.
7. **Color carries state; typography carries structure.** Do not ask a pill or accent color to organize every attribute.
8. **Constrained width is a priority test.** Collapse navigation and defer secondary detail before shrinking core content into ambiguity.
9. **Recovery must explain itself.** Imports, autosaves, launches, saves, and exports always surface progress and a durable outcome.
