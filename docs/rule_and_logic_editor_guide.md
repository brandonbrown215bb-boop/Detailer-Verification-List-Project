# AHU Verification Rule & Logic Editor Guide

A comprehensive reference for engineering leads and developers authoring, auditing, testing, and publishing verification rules for the **AHU Detailing Verification System**.

---

## Table of Contents
1. [System Architecture & Overview](#1-system-architecture--overview)
2. [Internal Naming Key & Data Dictionary](#2-internal-naming-key--data-dictionary)
   - [2.1 Rule Definition Data Model](#21-rule-definition-data-model)
   - [2.2 Scopes, Fact Statuses & Confidence States](#22-scopes-fact-statuses--confidence-states)
   - [2.3 Fact Dictionary Catalog](#23-fact-dictionary-catalog)
3. [Condition Operators & AST Specification](#3-condition-operators--ast-specification)
   - [3.1 Operator Mapping Key](#31-operator-mapping-key)
   - [3.2 AST Predicate JSON Structure](#32-ast-predicate-json-structure)
4. [Step-by-Step Logic Authoring Examples](#4-step-by-step-logic-authoring-examples)
   - [Example 1: Standard Universal Check (Always Applicable)](#example-1-standard-universal-check-always-applicable)
   - [Example 2: Numeric Threshold Comparison](#example-2-numeric-threshold-comparison)
   - [Example 3: Boolean Feature Flag Check](#example-3-boolean-feature-flag-check)
   - [Example 4: String / Enum Value Equality](#example-4-string--enum-value-equality)
   - [Example 5: Text Substring Search (`includes`)](#example-5-text-substring-search-includes)
   - [Example 6: Multi-Condition Conjunction (`ALL / AND`)](#example-6-multi-condition-conjunction-all--and)
   - [Example 7: Discrete List Membership (`in`)](#example-7-discrete-list-membership-in)
   - [Example 8: Nested Compound Logic (`AND` with nested `OR`)](#example-8-nested-compound-logic-and-with-nested-or)
   - [Example 9: Missing / Unconfirmed Data (`NeedsInput`)](#example-9-missing--unconfirmed-data-needsinput)
5. [Studio UI Walkthrough & Simulation Sandbox](#5-studio-ui-walkthrough--simulation-sandbox)
   - [5.1 Rule Explorer Panel](#51-rule-explorer-panel)
   - [5.2 Rule Form & Visual Condition Builder](#52-rule-form--visual-condition-builder)
   - [5.3 Live Simulation Sandbox](#53-live-simulation-sandbox)
6. [Publishing, Semantic Versioning & Integrity Pipeline](#6-publishing-semantic-versioning--integrity-pipeline)

---

## 1. System Architecture & Overview

The **Rule & Logic Editor** is delivered as a dedicated desktop studio (`AHUVerification.RuleEditor` / `RuleEditor.exe`) and web interface (`rule-editor.html`). It decouples engineering rule authoring from hardcoded program logic or manual JSON editing, allowing team leads to author, test, and publish rule packs safely with cryptographic integrity verification.

```mermaid
flowchart TD
    subgraph Studio["Rule Editor Desktop Studio (RuleEditor.exe)"]
        UI["Visual Condition Builder & Form (React / Tailwind)"]
        ASTConv["AST Converter (astConverter.ts)"]
        Sandbox["Live Test Sandbox (RuleTestSandbox.tsx)"]
        DiffEngine["Diff & Publish Engine (PublishModal.tsx)"]
    end

    subgraph Core["AHUVerification.Core Engine"]
        Evaluator["AST Predicate Evaluator (AstRuleEvaluator.cs)"]
        PackMgr["Rule Pack Manager & Hashing (RulePackManager.cs)"]
    end

    subgraph Storage["Rule Pack Bundle (/resources/rulepack)"]
        RJSON["rules.json (LF Canonical UTF-8)"]
        TMAP["template_map.json (Decoupled Semantic Mappings)"]
        APP["approved_mappings.json"]
        XLSX["template.xlsx (OpenXML Master)"]
        MANI["manifest.json (SHA-256 Integrity Hashes)"]
    end

    UI <--> ASTConv
    ASTConv <--> Sandbox
    Sandbox --> Evaluator
    DiffEngine --> PackMgr
    PackMgr --> Storage
```

### Launching the Rule Editor
- Run `launch-rule-editor.bat` from the repository root, or
- Select **Option 3** from `menu.bat`.

---

## 2. Internal Naming Key & Data Dictionary

### 2.1 Rule Definition Data Model

Every verification rule is defined using the internal `RuleDefinition` contract:

| UI Field Label | Internal Property Name | Data Type | Example / Allowed Values | Purpose & Description |
| :--- | :--- | :--- | :--- | :--- |
| **Rule ID** | `id` | `string` | `"BASE-01"`, `"HOUS-07"` | Unique alphanumeric rule code used across reports and checklists. |
| **Semantic Key** | `semanticKey` | `string` | `"BASE_LIFTING_LUG_SUPPORT"` | UPPER_SNAKE_CASE identifier decoupling rule logic from physical Excel cell addresses. |
| **Category** | `category` | `string` | `"Base"`, `"Housing"`, `"Drain Pan"`, `"Coil Panels"`, `"Internal"`, `"Reconnects"`, `"Paperwork"`, `"MOM"` | Primary checklist section and tab classification. |
| **Internal Subgroup** | `subgroup` | `string?` | `"Fan Segments"`, `"Coil Segments"`, `"Filter Segments"`, `"Access Segments"`, `"Damper Segments"` | Sub-classification within the `"Internal"` category. |
| **Scope** | `scope` | `RuleScope` | `'Unit'`, `'Skid'`, `'Segment'`, `'Component'` | Determines rule evaluation target multiplicity. |
| **Checklist Instruction Text** | `text` | `string` | `"Lifting lugs have proper support when the skid is over 4,000 lbs..."` | Clear, actionable instruction text presented to detailers and checkers. |
| **Standard Reference** | `reference` | `string?` | `"ASSY Manual p.391-40206-003"` | Standard assembly manual, drawing number, or engineering specification reference. |
| **Excel Row** | `excelRow` | `number?` | `29`, `61` | Output row index in `template.xlsx` (translated via `template_map.json`). |
| **Required Facts** | `requiredFacts` | `string[]` | `["skid.weight"]` | Set of XML fact keys required to evaluate this rule. Auto-derived from the AST condition tree. |
| **Applicability Logic** | `predicate` | `ASTPredicate?` | `AST JSON Object` or `undefined` | Boolean AST condition tree. When absent (`undefined`), rule is unconditionally applicable. |
| **Allow N/A Toggle** | `allowNA` | `boolean` | `true` / `false` | When `false`, detailers cannot mark the check N/A; it must be checked Pass/Fail. |
| **Verification Mode** | `verificationMode` | `string` | `'ManualCheckbox'`, `'AutoEvaluated'`, `'MeasurementVerify'` | Interaction style in the detailer desktop interface. |
| **Archived** | `isArchived` | `boolean?` | `true` / `false` | When `true`, rule is soft-deleted and excluded from active checklist synthesis. |

---

### 2.2 Scopes, Fact Statuses & Confidence States

#### Scopes (`RuleScope`)
- **`Unit`**: Evaluated once globally for the overall AHU.
- **`Skid`**: Evaluated per discrete shipping section (Skid `1..N`).
- **`Segment`**: Evaluated per AHU casing segment (e.g. `segment_IP`, `segment_CC`).
- **`Component`**: Evaluated per individual internal mechanical or electrical device.

#### Fact Provenance Status (`FactStatus`)
- **`Known`**: Fact value was parsed authoritatively from unit XML.
- **`Derived`**: Fact value was synthesized from related unit geometry or segment features.
- **`Unknown`**: Fact was missing or unparseable in source data.
- **`ManuallyOverridden`**: Fact was manually entered or updated by the detailer.

#### Fact Confidence (`FactConfidence`)
- **`Authoritative`**: Safe for automatic rule evaluation.
- **`RequiresConfirmation`**: Fact value is uncertain; requires detailer confirmation before dependent rules evaluate.

#### Rule Applicability Outcomes (`RuleApplicability`)
- **`Applicable`**: Condition evaluated to `true`; check is active for the detailer.
- **`NotApplicable`**: Condition evaluated to `false`; check is automatically marked `NA`.
- **`NeedsInput`**: One or more `requiredFacts` are `Unknown` or `RequiresConfirmation`.

---

### 2.3 Fact Dictionary Catalog

The visual condition builder integrates domain facts across 4 scopes:

| Fact Key | Scope | Data Type | Units / Enum Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| `unit.shellType` | `Unit` | `enum` | `ThermalBreak`, `Standard`, `CustomThermalBreak` | Casing profile and thermal break construction. |
| `unit.unitType` | `Unit` | `enum` | `Outdoor`, `Indoor` | Installation environment. |
| `unit.wallThickness` | `Unit` | `number` | `inches` (e.g. `2`, `3`, `4`) | Nominal casing wall thickness. |
| `unit.baseHeight` | `Unit` | `number` | `inches` (e.g. `6`, `8`, `10`, `12`) | Structural base channel height. |
| `unit.thermalBreak` | `Unit` | `enum` | `Yes`, `No` | Thermal-break framing profile parameter. |
| `unit.knockdown` | `Unit` | `boolean` | `true`, `false` | Disassembled field-assembled unit flag (KD). |
| `unit.washdown` | `Unit` | `boolean` | `true`, `false` | Hygienic washdown / sloped floor construction. |
| `unit.hasUTL` | `Unit` | `boolean` | `true`, `false` | Base perimeter upturned lip presence. |
| `unit.isSeismic` | `Unit` | `boolean` | `true`, `false` | Structural seismic calculation requirement. |
| `unit.unitConstructionType` | `Unit` | `enum` | `Standard`, `IBC`, `OSHPD`, `NOA` | Governing structural specification. |
| `unit.noa` | `Unit` | `enum` | `NOA`, `N/A` | Miami-Dade hurricane wind certification. |
| `unit.totalStaticPressure` | `Unit` | `number` | `in. w.g.` (e.g. `2.5`) | Design total static pressure (TSP). |
| `unit.floorMaterial` | `Unit` | `enum` | `Galvanized`, `Aluminum`, `Aluminum Diamond Plate`, `Stainless 304`, `Stainless 316` | Floor skin sheet metal type. |
| `unit.floorMaterialGauge` | `Unit` | `number` | `ga` (e.g. `14`, `16`) | Floor metal thickness gauge. |
| `unit.exteriorMaterial` | `Unit` | `enum` | `Galvanized`, `Pre-Painted`, `Aluminum`, `Stainless 304`, `Stainless 316` | Outer skin metal type. |
| `unit.interiorMaterial` | `Unit` | `enum` | `Galvanized`, `Aluminum`, `Perforated Galvanized`, `Stainless 304`, `Stainless 316` | Inner liner sheet metal type. |
| `unit.insulationType` | `Unit` | `enum` | `Injected Foam (R-13)`, `Injected Foam (R-20)`, `Fiberglass`, `Mineral Wool` | Panel core insulation material. |
| `unit.slopedRoof` | `Unit` | `boolean` | `true`, `false` | Sloped roof for rain runoff. |
| `unit.roofSlope` | `Unit` | `number` | `in/ft` (e.g. `0.25`) | Roof pitch slope. |
| `unit.curbrest` | `Unit` | `enum` | `Yes`, `No` | Roof curb rest mounting. |
| `unit.brandOption` | `Unit` | `enum` | `York Custom AHU`, `Solution XT`, `AirMatrix` | Product family brand series. |
| `skid.weight` | `Skid` | `number` | `lbs` (e.g. `4500`) | Total shipping weight for lifting calculations. |
| `skid.segmentCount` | `Skid` | `number` | `count` (e.g. `3`) | Number of casing segments on this base skid. |
| `skid.length` | `Skid` | `number` | `inches` | Total length of skid base steel. |
| `skid.width` | `Skid` | `number` | `inches` | Total width across skid base. |
| `skid.height` | `Skid` | `number` | `inches` | Overall height from bottom of channel to roof. |
| `skid.hasDrainPan` | `Skid` | `boolean` | `true`, `false` | Drain pan presence on this skid. |
| `skid.hasFans` | `Skid` | `boolean` | `true`, `false` | Supply, return, or exhaust fans on this skid. |
| `skid.hasCoils` | `Skid` | `boolean` | `true`, `false` | Heating or cooling coils on this skid. |
| `skid.hasFilters` | `Skid` | `boolean` | `true`, `false` | Filter banks/racks on this skid. |
| `skid.hasHeatWheel` | `Skid` | `boolean` | `true`, `false` | Energy recovery wheel on this skid. |
| `skid.hasBaseSteel` | `Skid` | `boolean` | `true`, `false` | Structural steel channel base presence. |
| `segment.typeCode` | `Segment` | `enum` | `FS`, `FR`, `FE`, `CC`, `HC`, `FF`, `AF`, `RF`, `HF`, `IP`, `DP`, `MB`, `XA`, `HW`, `HX`, `EH`, `PC` | Two-letter AHU segment functional code. |
| `segment.airPressureType` | `Segment` | `enum` | `Positive`, `Negative` | Static pressure regime. |
| `segment.airVolume` | `Segment` | `number` | `CFM` | Design airflow volume. |
| `segment.hasMotorRemovalRail` | `Segment` | `boolean` | `true`, `false` | Overhead motor removal trolley beam presence. |
| `motorControl.motorControlType` | `Component` | `enum` | `VFD`, `Starter`, `DisconnectOnly` | Motor starter / drive package. |
| `motorControl.fla` | `Component` | `number` | `Amps` (e.g. `28.5`) | Motor full load amperes. |
| `motorControl.hp` | `Component` | `number` | `HP` (e.g. `20`) | Motor horsepower. |
| `motorControl.voltage` | `Component` | `number` | `Volts` (e.g. `460`) | Motor supply voltage. |

---

## 3. Condition Operators & AST Specification

### 3.1 Operator Mapping Key

The visual builder synchronizes bidirectionally with AST JSON predicates using standard operator tokens:

| Visual Builder Operator Label | Internal Operator Token | AST JSON Expression | Evaluation Semantics |
| :--- | :--- | :--- | :--- |
| **equals (===)** | `===` | `{"===": [{"var": "<key>"}, <value>]}` | Strict equality matching. |
| **not equal (!==)** | `!==` | `{"!==": [{"var": "<key>"}, <value>]}` | Strict inequality matching. |
| **greater than (>)** | `>` | `{">": [{"var": "<key>"}, <number>]}` | Number is strictly greater than target. |
| **greater or equal (>=)** | `>=` | `{">=": [{"var": "<key>"}, <number>]}` | Number is greater than or equal to target. |
| **less than (<)** | `<` | `{"<": [{"var": "<key>"}, <number>]}` | Number is strictly less than target. |
| **less or equal (<=)** | `<=` | `{"<=": [{"var": "<key>"}, <number>]}` | Number is less than or equal to target. |
| **contains text** | `includes` | `{"includes": [{"var": "<key>"}, "<text>"]}` | Case-insensitive substring match. |
| **is one of (list)** | `in` | `{"in": [{"var": "<key>"}, ["A", "B", ...]]}` | Discrete list item membership. |
| **is True** | `is_true` | `{"===": [{"var": "<key>"}, true]}` | Evaluates boolean fact is `true`. |
| **is False** | `is_false` | `{"===": [{"var": "<key>"}, false]}` | Evaluates boolean fact is `false`. |
| **is Defined** | `is_defined` | `{"!==": [{"var": "<key>"}, null]}` | Evaluates fact is not null or missing. |
| **ALL (AND)** | `and` | `{"and": [<condition1>, <condition2>, ...]}` | Conjunction: All child conditions must be true. |
| **ANY (OR)** | `or` | `{"or": [<condition1>, <condition2>, ...]}` | Disjunction: At least one condition must be true. |

### 3.2 AST Predicate JSON Structure

Variables are identified using the object notation `{"var": "factKey"}`. Static literals are represented as JSON strings, numbers, or booleans.

```json
{
  "and": [
    {
      "===": [
        { "var": "unit.unitType" },
        "Outdoor"
      ]
    },
    {
      ">=": [
        { "var": "unit.totalStaticPressure" },
        3.0
      ]
    }
  ]
}
```

---

## 4. Step-by-Step Logic Authoring Examples

### Example 1: Standard Universal Check (Always Applicable)
- **Plain English Intent**: A standard baseline verification check that applies to every unit without restriction (e.g. general drafting notes, dimension stamps).
- **Visual Condition Builder**: Empty group (0 conditions).
- **AST JSON**:
```json
{}
```
- **Required Facts**: `[]`
- **Evaluation Trace**: `"Standard check (Always applicable)"` $\rightarrow$ **`Applicable`**

---

### Example 2: Numeric Threshold Comparison
- **Rule ID**: `BASE-01`
- **Plain English Intent**: Lifting lug reinforcement check required only when shipping skid weight exceeds 4,000 lbs.
- **Visual Condition Builder**:
  - Match: `ALL (AND)`
  - Condition: `skid.weight` `>` `4000`
- **AST JSON**:
```json
{
  ">": [
    { "var": "skid.weight" },
    4000
  ]
}
```
- **Required Facts**: `["skid.weight"]`
- **Live Evaluation Traces**:
  - Skid weight = `4500` $\rightarrow$ `"Evaluated: 4500 > 4000 (True)"` $\rightarrow$ **`Applicable`**
  - Skid weight = `3200` $\rightarrow$ `"Evaluated: 3200 > 4000 (False)"` $\rightarrow$ **`NotApplicable`**

---

### Example 3: Boolean Feature Flag Check
- **Rule ID**: `BASE-08`
- **Plain English Intent**: Floor skin support check required only if the skid contains a drain pan.
- **Visual Condition Builder**:
  - Match: `ALL (AND)`
  - Condition: `skid.hasDrainPan` `is True`
- **AST JSON**:
```json
{
  "===": [
    { "var": "skid.hasDrainPan" },
    true
  ]
}
```
- **Required Facts**: `["skid.hasDrainPan"]`
- **Live Evaluation Traces**:
  - `skid.hasDrainPan = true` $\rightarrow$ `"Evaluated: true === true (True)"` $\rightarrow$ **`Applicable`**
  - `skid.hasDrainPan = false` $\rightarrow$ `"Evaluated: false === true (False)"` $\rightarrow$ **`NotApplicable`**

---

### Example 4: String / Enum Value Equality
- **Rule ID**: `HOUS-07`
- **Plain English Intent**: Skin hole removal at unit splits required only for outdoor units.
- **Visual Condition Builder**:
  - Match: `ALL (AND)`
  - Condition: `unit.unitType` `===` `"Outdoor"`
- **AST JSON**:
```json
{
  "===": [
    { "var": "unit.unitType" },
    "Outdoor"
  ]
}
```
- **Required Facts**: `["unit.unitType"]`

---

### Example 5: Text Substring Search (`includes`)
- **Rule ID**: `BASE-13`
- **Plain English Intent**: Aluminum floor drain support spacing applies whenever the floor skin material contains `"AL"` (matches `"Aluminum"` or `"Aluminum Diamond Plate"`).
- **Visual Condition Builder**:
  - Match: `ALL (AND)`
  - Condition: `unit.floorMaterial` `contains text` `"AL"`
- **AST JSON**:
```json
{
  "includes": [
    { "var": "unit.floorMaterial" },
    "AL"
  ]
}
```
- **Required Facts**: `["unit.floorMaterial"]`

---

### Example 6: Multi-Condition Conjunction (`ALL / AND`)
- **Rule ID**: `HOUS-26`
- **Plain English Intent**: High-pressure outdoor structural framing check required if unit is `Outdoor` **AND** Total Static Pressure is $\ge$ `3.0` in. w.g.
- **Visual Condition Builder**:
  - Match: `ALL (AND)`
    - Condition 1: `unit.unitType` `===` `"Outdoor"`
    - Condition 2: `unit.totalStaticPressure` `>=` `3.0`
- **AST JSON**:
```json
{
  "and": [
    {
      "===": [
        { "var": "unit.unitType" },
        "Outdoor"
      ]
    },
    {
      ">=": [
        { "var": "unit.totalStaticPressure" },
        3.0
      ]
    }
  ]
}
```
- **Required Facts**: `["unit.totalStaticPressure", "unit.unitType"]`
- **Evaluation Trace**: `"Evaluated: Outdoor === Outdoor (True) AND Evaluated: 3.5 >= 3.0 (True)"` $\rightarrow$ **`Applicable`**

---

### Example 7: Discrete List Membership (`in`)
- **Rule ID**: `INT-FAN-01`
- **Plain English Intent**: Overhead motor removal rail check applies if the segment is a supply (`FS`), return (`FR`), or exhaust (`FE`) fan segment.
- **Visual Condition Builder**:
  - Match: `ALL (AND)`
  - Condition: `segment.typeCode` `is one of (list)` `FS, FR, FE`
- **AST JSON**:
```json
{
  "in": [
    { "var": "segment.typeCode" },
    ["FS", "FR", "FE"]
  ]
}
```
- **Required Facts**: `["segment.typeCode"]`

---

### Example 8: Nested Compound Logic (`AND` with nested `OR`)
- **Rule ID**: `SPEC-01`
- **Plain English Intent**: Seismic tie-down verification required if unit has seismic requirements **AND** either (Wall Thickness $\ge$ 3" **OR** Knockdown is `true`).
- **Visual Condition Builder**:
  - Match: `ALL (AND)`
    - Condition 1: `unit.isSeismic` `is True`
    - Nested Group: `ANY (OR)`
      * Condition A: `unit.wallThickness` `>=` `3`
      * Condition B: `unit.knockdown` `is True`
- **AST JSON**:
```json
{
  "and": [
    {
      "===": [
        { "var": "unit.isSeismic" },
        true
      ]
    },
    {
      "or": [
        {
          ">=": [
            { "var": "unit.wallThickness" },
            3
          ]
        },
        {
          "===": [
            { "var": "unit.knockdown" },
            true
          ]
        }
      ]
    }
  ]
}
```
- **Required Facts**: `["unit.isSeismic", "unit.knockdown", "unit.wallThickness"]`

---

### Example 9: Missing / Unconfirmed Data (`NeedsInput`)
- **Scenario**: A rule requires `unit.isSeismic`, but the source XML lacked seismic data, marking the fact as `Unknown` or `RequiresConfirmation`.
- **AST JSON**:
```json
{
  "===": [
    { "var": "unit.isSeismic" },
    true
  ]
}
```
- **Required Facts**: `["unit.isSeismic"]`
- **Evaluator Outcome**:
  - `NeedsInput = true`
  - `Result = false`
  - `Trace = "Required fact 'Seismic Certification Requirement' requires confirmation or is unknown (Unknown)"`
  - The check displays in the checklist with an interactive resolution badge prompting detailer confirmation.

---

## 5. Studio UI Walkthrough & Simulation Sandbox

```mermaid
graph LR
    A["1. Rule Explorer"] -->|Select / Filter / New| B["2. Rule Form View"]
    B -->|Visual Tree Edit| C["3. Auto-Derived AST"]
    C -->|Realtime Evaluation| D["4. Test Sandbox"]
    D -->|Tweak Facts Live| D
    B -->|Draft Edits Staged| E["5. Publish Release"]
    E -->|Diff Review & SemVer| F["6. Canonical SHA-256 Bundle"]
```

### 5.1 Rule Explorer Panel
Located on the left pane:
- **Category Tabs**: Switch between `Base`, `Housing`, `Drain Pan`, `Coil Panels`, `Internal`, `Reconnects`, `Paperwork`, and `MOM`.
- **Search Bar**: Live search across Rule IDs, instruction text, semantic keys, and fact keys.
- **Scope & Status Filters**: Filter by `Unit`, `Skid`, `Segment`, or `Component`; filter by `Active`, `Archived`, or `Modified (Uncommitted)`.
- **Reorder & Clone**: Move rules up/down within their category or duplicate rules with `-COPY` suffix.

### 5.2 Rule Form & Visual Condition Builder
Located in the center pane:
- **Auto-Generate Key**: Generates a clean `CATEGORY_FEATURE_NAME` semantic key.
- **Visual / JSON AST Toggle**: Switch seamlessly between no-code visual condition blocks and raw JSON AST editing with live syntax validation.
- **Auto-Derivation of `requiredFacts`**: Adding or modifying condition leaves automatically extracts and indexes referenced fact keys.

### 5.3 Live Simulation Sandbox
Located on the right pane:
- **Profile Presets**: Test against preconfigured models (e.g. *Standard 2-Skid Outdoor Unit*, *Heavy 4-Skid Washdown & Seismic Unit*).
- **Interactive Fact Tweakers**: Adjust numbers, toggles, or enums with immediate live recalculation of applicability outcomes and step-by-step logic traces.

---

## 6. Publishing, Semantic Versioning & Integrity Pipeline

When authoring is complete, clicking **Publish Release** opens the release modal:

```mermaid
sequenceDiagram
    autonumber
    actor Lead as Engineering Lead
    participant Studio as Rule Editor Studio
    participant Mgr as RulePackManager.cs
    participant Disk as Staged RulePack Folder

    Lead->>Studio: Click Publish Release
    Studio->>Studio: Compute visual diff (added, modified, archived)
    Lead->>Studio: Select Version Bump (Patch / Minor / Major) + Release Notes
    Studio->>Mgr: PublishRulePack(payload)
    Mgr->>Disk: Write LF-normalized rules.json & template_map.json
    Mgr->>Disk: Copy template.xlsx
    Mgr->>Mgr: Calculate SHA-256 for all 4 artifacts
    Mgr->>Mgr: Compute canonical bundleSha256
    Mgr->>Disk: Write manifest.json
    Mgr-->>Studio: Validation Success (RulePackBundle)
    Studio-->>Lead: Success Notification (v14.1.0 Ready)
```

### Semantic Versioning Rules
- **Patch (`14.0.1`)**: Typo corrections, reference document updates, or minor comment clarifications.
- **Minor (`14.1.0`)**: Added rules, modified conditions, or updated applicability logic.
- **Major (`15.0.0`)**: Template restructurings, new categories, or breaking OpenXML deliverable changes.

### Integrity & Hashing Invariants
1. **LF Normalization**: All JSON artifacts (`rules.json`, `template_map.json`, `approved_mappings.json`, `manifest.json`) are serialized with LF line endings (`\n`) and UTF-8 encoding (no BOM).
2. **Deterministic Hashes**: `RulePackManager.ComputeBundleSha256` computes the master `bundleSha256` from the individual artifact hashes.
3. **Atomic Deployment**: The desktop application verifies bundle integrity on startup and rejects tampered rule packs, falling back to the Last Known Good (LKG) version.
