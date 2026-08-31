# 4. UPZ Bundle Ingestion and Order Metadata Traces

Date: 2026-08-26
Status: Accepted

## Context

Factory detailers work with unit packages exported as `.upz` archives from YorkWorks / MOM. Previously, the verification application only accepted standalone `Config.xml` files, leaving order-level facts (`Job Name`, `Order Number`, `Unit Tag`, `Product Type`) unpopulated.

The `.upz` file is a proprietary container format (`upl\0`) enclosing synchronized XML documents: `Config.xml`, `OrderRev.xml`, and `Manifest.xml`. Standard PKZip tools cannot open `.upz` archives, but JCI's native standalone unpacker (`unpack32.exe` / `ywunpack.dll`) decompresses them cleanly and deterministically.

## Decisions

1. **Native UPZ Decompression Toolchain**:
   - Bundle `unpack32.exe` and `ywunpack.dll` in `resources/bin/` as deployable desktop assets.
   - Execute decompression via `UpzBundleExtractor` using isolated temporary directories with automatic cleanup.
   - `unpack32.exe` requires a trailing separator on its destination path. The current extractor times out after 30 seconds but does not inspect a non-zero process exit code; failures may surface later as missing `Config.xml`. This is a known implementation limitation, not a guaranteed diagnostic.
   - The packaged `resources/bin/` location is the supported deployment location. A hard-coded developer fallback remains in source and must not be relied on for deployment.
   - For browser preview mode (without native desktop helper), state clearly that `.upz` decompression requires the desktop host, while maintaining standalone `Config.xml` and `.dvl` support.

2. **Order Metadata Trace Extraction**:
   - The C# implementation is `OrderRevParser`; TypeScript exports `parseOrderRevXml` from `src/services/xmlParser.ts` rather than a separate parser class.
   - Extract `jobName`, `orderNumber`, `tagList` / `primaryTag`, and `productType` from `OrderRev.xml`.
   - Fields not needed for verification deliverables (`quantity`, `salesEngineer`, `revisionDate`) are excluded from domain fact extraction.

3. **Authoritative Fact Provenance & COM # Manual Boundary**:
   - When ingesting a `.upz` bundle, populate `unit.jobName`, `unit.orderNumber`, `unit.tag`, and `unit.productType` with `Status = Known` and `Confidence = Authoritative`.
   - **COM # Boundary**: Clarify that `<orderNumber>` in `OrderRev.xml` is the manufacturing Order Number (Release/Order #), NOT the COM #. The COM # is unexposed in the XML and remains an explicit manual entry field for detailers (prompted via MAPICS order packet).
   - Retain fallback behavior for standalone `Config.xml` files where order metadata is absent.

4. **Persistence in `.dvl` Projects**:
   - Record `isUpzBundle` and `orderRevision` metadata under `sourceXml` in `.dvl` project files to ensure downstream audits preserve package provenance.

## Consequences

- Detailers can open `.upz` archives directly via Drag-and-Drop or File Dialog without manual extraction steps.
- `Job Name` (`Verification List` cell `D5`), `Order Number`, `Unit Tag`, and engineering specifications are populated automatically with authoritative provenance.
- `COM #` (`Verification List` cell `D6`) remains a clear, prompt-guided manual entry field for detailers.
- Standalone `Config.xml` workflows remain 100% backward compatible.
