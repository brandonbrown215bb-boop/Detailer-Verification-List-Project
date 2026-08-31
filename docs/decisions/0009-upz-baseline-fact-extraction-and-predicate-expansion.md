# 9. UPZ Baseline Fact Extraction and Rule Predicate Expansion

Date: 2026-08-27
Status: Accepted

## Context

The Detailing Verification List application serves as an automated verification framework for York Custom Air Handling Units (AHUs). UPZ bundle archives (`.upz` containing `Config.xml`, `OrderRev.xml`, and `Manifest.xml`) are consumed first and foremost as an authoritative baseline model representing the engineering design.

Previously, fact extraction and graph normalization captured top-level unit options and segment casing, but omitted critical geometric sub-trees—such as the opening schedule (doors, dampers, floor drains), component configurations (fan arrays, coils, filters, heat wheels), per-face casing thicknesses, and structural upper deck geometry. Furthermore, certain facts contained presentation-layer formatting (e.g. `"Yes (2.0\" Lip)"` or string flags) rather than raw typed primitives, hindering declarative AST rule authoring in the Rule & Logic Editor.

## Decisions

1. **Baseline Ingestion Philosophy**:
   - UPZ data is ingested as the authoritative unit baseline. Verification rules consume facts via declarative AST predicates, without modifying existing verified rules (`rules.json` stability directive).

2. **Opening Schedule Ingestion (`<openingList>`)**:
   - Ingest all door definitions (`UnitDoor`: width, height, swing, hinge side, window, viewport, latch type).
   - Ingest all damper definitions (`UnitDamper`: width, height, depth, damper type, actuator type, blade type, attached louver).
   - Ingest all floor drain cutouts (`UnitFloorDrain`: type, piping material, connection diameter, hole diameter [3.125" Aluminum / 1.50" Steel], connection side, and 3D spatial coordinates).

3. **Component Configuration Sub-Trees (`<segmentConfig_*>`)**:
   - `FanConfig`: Ingests fan array grid (`fanArrayQtyHeight` × `fanArrayQtyWidth`), fan redundancy flag, fan stand, dual fan separation walls, motor removal rails, isolation types, motor HP, and voltage.
   - `CoilConfig`: Ingests bulkhead material (`STL GALV`, `StainlessSteel`), coil stacking rack existence and material, drip pan material, staggered overlap dimensions, connection hand, and coil count.
   - `FilterConfig`: Ingests filter type, load method (`FrontLoad`, `SideLoad`), bulkhead material, and differential pressure gauge type/door ID.
   - `HeatWheelConfig`: Ingests vendor, model, wheel type (Enthalpy, Sensible), media type, purge sector, variable speed drive support, diameter, and recovery CFM.

4. **Tiered vs. Stacked Unit Structural Semantics**:
   - *Tiered Units* (`unit.isTiered`, `segment.isTiered`, `segment.tierLevel`): Defined as one or more segments elevated on top of another segment deck without an independent unit base at that elevation ($y > \text{defaultBaseHeight} + 10$ and no matching unit base).
   - *Stacked Units* (`unit.isStacked`, `base.isUpperBase`): Defined by the presence of a distinct unit base situated on top of a lower unit or segment ($y > 15$).

5. **Strict Primitive Data Types & AST Predicates**:
   - `unit.lipHeight`: Raw numeric value (e.g. `2.0` or `0.0`), replacing string-derived `"Yes (2.0\" Lip)"`.
   - `unit.thermalBreak`: Pure boolean (`true` / `false`), derived from `housingStyle.Contains("ThermalBreak")`.
   - `unit.noa`: Pure boolean (`true` / `false`), derived from `unitConstructionType == "NOA"`.
   - `unit.isSeismic`: Pure boolean (`true` / `false`), derived from `unitConstructionType` (`IBC` or `OSHPD`).
   - `unit.curbrest`: Pure boolean (`true` / `false`), derived from `curbOptions/hasCurbRest`. Curb height and provider details are excluded from current scope.
   - `roof.roofPeak`: Categorical string normalized to `'Center'`, `'Left'`, `'Right'`, or `'Flat'`.

6. **Deflection Testing & Quality Standards**:
   - Deflection testing (`testingOptions/deflectionTest`) is ingested strictly as an AST rule predicate for structural framing rules (e.g. `BASE_STRUCTURAL_STEEL_DEFLECTION`), not as user-facing general specification display.

7. **Special Quotes (SQ) Policy**:
   - UPZ embedded SQ nodes (e.g. `baseSQOrderNumber`) are ignored because they lack actionable detailer text. Special quotes are manually entered by detailers from the MAPICS order packet into a dynamic unbounded table.

## Consequences

- The visual AST Rule & Logic Editor has full access to 50+ strongly-typed domain facts across openings, components, subfloors, and structural geometries.
- XML parsing across all 18 UPZ unit examples is intended to run in both C# (.NET 8) and TypeScript (browser/Vite); native-UPZ extraction still requires the licensed unpacker assets to be staged.
- Existing checklist evaluation remains backward-compatible with 0 regressions in existing test suites.

## Addendum (2026-08-28): fact and geometry conventions

Opening facts are indexed by source ID: `door.{id}.width` (with related door fields), `damper.{id}.type`/`.actuator`/`.width`/`.height`, and `floorDrain.{id}.holeDiameter`. The floor-drain diameter is a derived fact. Tier classification requires `y > defaultBaseHeight + 10` and no base with `abs(base.y - segment.y) < 5`; stacked bases remain `y > 15`.

`testingOptions/deflectionTest` is published as `unit.deflectionTest` for AST rules. These keys, rather than presentation labels, are the supported rule-authoring contract.
