# 6. Manual Unit Setup Wizard and Baseline Structural Graph Synthesis

Date: 2026-08-26
Status: Accepted

## Context

In early quoting stages, custom replacement orders, or field modifications, detailers may not have a selection XML export (`Config.xml` or `.upz`). Without an engineering export, the application could not previously evaluate rules or construct the data graph.

To support XML-less workflows while maintaining identical domain rules and OpenXML deliverable capabilities, a mechanism is needed to synthesize a valid structural model from high-level manual user input.

## Decisions

1. **Manual Unit Configuration Wizard (`ManualUnitModal.tsx`)**:
   - Provide a guided 3-step setup modal for manual unit creation.
   - Capture critical unit parameters: Job Name, Product Type (`SolutionYC`, `SolutionXT`, etc.), Shell Type, Unit Type, Base Height, Wall Thickness, Thermal Break, Hand Orientation, Aspect Ratio (Height/Width), Total Air Volume (CFM), Static Pressure (in. wg), and Skid Count with Segments.

2. **Structural Graph Synthesis Engine (`manualUnitFactory.ts`)**:
   - `createManualUnit` synthesizes a compliant `NormalizedXmlGraph` object matching the exact schema produced by `NormalizedXmlParser`.
   - Default segments (e.g. Supply Fan `FS`, Cooling Coil `CC`, Access `XA`, Filter `FF`) and bases are constructed with calculated dimensions, gauges, materials, and internal attributes.
   - Default shipping skids are generated mapping the specified segments.

3. **Fact Registry Integration & Fact Provenance**:
   - Synthesized parameters are registered into `FactRegistry` with `Status = ManuallyOverridden` and `Confidence = Authoritative` to indicate manual provenance.
   - Rules evaluation runs identically across synthesized graphs as it does with parsed XML.

## Consequences

- Detailers can create and verify projects from scratch without XML selection files.
- Full parity with standard XML workflows: SQs, Rule evaluation, Resolution Center, and Excel deliverable export work seamlessly.
- Manual facts are clearly distinguished in the audit log and provenance metadata.
