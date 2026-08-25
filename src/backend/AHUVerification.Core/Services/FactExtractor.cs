using System;
using System.Collections.Generic;
using System.Linq;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Services
{
    public class FactExtractor
    {
        public static Fact CreateFact(
            string key,
            string label,
            string category,
            object? value,
            FactStatus status,
            FactConfidence confidence,
            string? sourcePointer = null,
            string? promptNote = null,
            string? derivationName = null)
        {
            return new Fact
            {
                Key = key,
                Label = label,
                Category = category,
                Value = value,
                Status = status,
                Confidence = confidence,
                SourcePointer = sourcePointer,
                SourceRawValue = value,
                PromptNote = promptNote,
                DerivationName = derivationName,
                OverrideHistory = new List<FactOverrideEntry>()
            };
        }

        public Dictionary<string, Fact> ExtractFacts(NormalizedXmlGraph graph)
        {
            var facts = new Dictionary<string, Fact>();

            // Order & Identity
            facts["unit.jobName"] = CreateFact(
                "unit.jobName",
                "Job Name",
                "Order & Identity",
                "Medical Center Phase 3",
                FactStatus.Known,
                FactConfidence.Authoritative,
                null,
                "Enter Job Name from Order Packet"
            );

            facts["unit.comNumber"] = CreateFact(
                "unit.comNumber",
                "COM #",
                "Order & Identity",
                "COM-842910",
                FactStatus.Known,
                FactConfidence.Authoritative,
                null,
                "Enter COM# from MAPICS"
            );

            facts["unit.detailer"] = CreateFact(
                "unit.detailer",
                "Detailer Name",
                "Order & Identity",
                "Tanner Dean",
                FactStatus.Known,
                FactConfidence.Authoritative
            );

            facts["unit.date"] = CreateFact(
                "unit.date",
                "Verification Date",
                "Order & Identity",
                DateTime.UtcNow.ToString("yyyy-MM-dd"),
                FactStatus.Known,
                FactConfidence.Authoritative
            );

            // Geometry & Casing
            facts["unit.shellType"] = CreateFact(
                "unit.shellType",
                "Shell Type",
                "Geometry & Casing",
                graph.UnitOptions.Materials.HousingStyle,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/housingStyle"
            );

            facts["unit.unitType"] = CreateFact(
                "unit.unitType",
                "Unit Type",
                "Geometry & Casing",
                graph.UnitOptions.UnitType,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/unitType"
            );

            facts["unit.baseHeight"] = CreateFact(
                "unit.baseHeight",
                "Base Height (in)",
                "Geometry & Casing",
                graph.UnitOptions.DefaultUnitBaseHeight,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultUnitBaseHeight"
            );

            facts["unit.wallThickness"] = CreateFact(
                "unit.wallThickness",
                "Wall Thickness (in)",
                "Geometry & Casing",
                2.0,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/surfaceDetail_Front/housingThickness",
                derivationName: "Housing Wall Thickness Spec"
            );

            facts["unit.thermalBreak"] = CreateFact(
                "unit.thermalBreak",
                "Thermal Break",
                "Geometry & Casing",
                graph.UnitOptions.Materials.HousingStyle.Contains("ThermalBreak", StringComparison.OrdinalIgnoreCase) ? "Yes" : "No",
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/housingStyle",
                derivationName: "Housing Style Contains ThermalBreak"
            );

            facts["unit.roofPeak"] = CreateFact(
                "unit.roofPeak",
                "Roof Peak (in)",
                "Geometry & Casing",
                graph.RoofOptions.HasSlopedRoof ? $"{graph.RoofOptions.RoofPeakZDim}\" ({graph.RoofOptions.RoofSlope}\"/ft)" : "Flat",
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/roofOptions",
                derivationName: "Roof Options Peak Calculation"
            );

            facts["unit.curbrest"] = CreateFact(
                "unit.curbrest",
                "Curbrest Option",
                "Geometry & Casing",
                graph.CurbOptions.HasCurbRest ? "Yes" : "No",
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/curbOptions/hasCurbRest"
            );

            // Ratings & Options (Derived from UnitConstructionType: Standard, IBC, OSHPD, NOA)
            string constType = graph.UnitOptions.UnitConstructionType ?? "Standard";
            bool isSeismic = constType.Equals("IBC", StringComparison.OrdinalIgnoreCase) || constType.Equals("OSHPD", StringComparison.OrdinalIgnoreCase);
            bool isNoa = constType.Equals("NOA", StringComparison.OrdinalIgnoreCase);
            bool isRecognized = constType.Equals("Standard", StringComparison.OrdinalIgnoreCase) ||
                                constType.Equals("IBC", StringComparison.OrdinalIgnoreCase) ||
                                constType.Equals("OSHPD", StringComparison.OrdinalIgnoreCase) ||
                                constType.Equals("NOA", StringComparison.OrdinalIgnoreCase);

            facts["unit.noa"] = CreateFact(
                "unit.noa",
                "Notice of Acceptance (NOA)",
                "Ratings & Options",
                isNoa ? "NOA" : "N/A",
                isRecognized ? FactStatus.Derived : FactStatus.Unknown,
                isRecognized ? FactConfidence.Authoritative : FactConfidence.RequiresConfirmation,
                "/root:AHU/unitOptions/unitConstructionType",
                isRecognized ? null : $"Unrecognized construction type '{constType}'. Specify Florida/Miami-Dade NOA wind load rating if applicable."
            );

            facts["unit.isSeismic"] = CreateFact(
                "unit.isSeismic",
                "Seismic Certification Required",
                "Ratings & Options",
                isSeismic,
                isRecognized ? FactStatus.Derived : FactStatus.Unknown,
                isRecognized ? FactConfidence.Authoritative : FactConfidence.RequiresConfirmation,
                "/root:AHU/unitOptions/unitConstructionType",
                isRecognized ? null : $"Unrecognized construction type '{constType}'. Verify if seismic IBC/OSHPD compliance and seismic reconnects are specified."
            );

            facts["unit.location"] = CreateFact(
                "unit.location",
                "Installation Location",
                "Ratings & Options",
                graph.UnitOptions.UnitType.Equals("Outdoor", StringComparison.OrdinalIgnoreCase) ? "Rooftop / Exterior" : "Mechanical Room",
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/unitType",
                derivationName: "UnitType Location Mapping"
            );

            facts["unit.knockdown"] = CreateFact(
                "unit.knockdown",
                "Knockdown Construction",
                "Ratings & Options",
                graph.UnitOptions.Knockdown ? "Yes" : "No",
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/knockdown"
            );

            facts["unit.utl"] = CreateFact(
                "unit.utl",
                "Upturned Lip (UTL)",
                "Geometry & Casing",
                graph.UnitOptions.HasUTL ? "Yes (2.0\" Lip)" : "No",
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/unitBaseList/unitBase/upturnedLipHeight",
                derivationName: "Detected UTL Lip Height > 0"
            );

            // Materials & Gauges
            facts["unit.linerMaterial"] = CreateFact(
                "unit.linerMaterial",
                "Liner Material",
                "Materials & Gauges",
                graph.UnitOptions.Materials.InteriorMaterialType,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/interiorMaterialType"
            );

            facts["unit.linerGauge"] = CreateFact(
                "unit.linerGauge",
                "Liner Gauge",
                "Materials & Gauges",
                graph.UnitOptions.Materials.InteriorMaterialGauge,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/interiorMaterialGauge"
            );

            facts["unit.skinMaterial"] = CreateFact(
                "unit.skinMaterial",
                "Skin Material",
                "Materials & Gauges",
                graph.UnitOptions.Materials.ExteriorMaterialType,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/exteriorMaterialType"
            );

            facts["unit.skinGauge"] = CreateFact(
                "unit.skinGauge",
                "Skin Gauge",
                "Materials & Gauges",
                graph.UnitOptions.Materials.ExteriorMaterialGauge,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/exteriorMaterialGauge"
            );

            facts["unit.floorMaterial"] = CreateFact(
                "unit.floorMaterial",
                "Floor Material",
                "Materials & Gauges",
                graph.UnitOptions.Materials.FloorMaterialType,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/floorMaterialType"
            );

            facts["unit.floorGauge"] = CreateFact(
                "unit.floorGauge",
                "Floor Gauge",
                "Materials & Gauges",
                graph.UnitOptions.Materials.FloorMaterialGauge,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/floorMaterialGauge"
            );

            facts["unit.totalWeight"] = CreateFact(
                "unit.totalWeight",
                "Total Unit Weight (lbs)",
                "Geometry & Casing",
                graph.UnitWeight,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitWeight"
            );

            facts["unit.totalStaticPressure"] = CreateFact(
                "unit.totalStaticPressure",
                "Total Static Pressure (in.w.g.)",
                "Geometry & Casing",
                graph.TotalStaticPressure,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/totalStaticPressure"
            );

            // Per-Skid Facts
            foreach (var skid in graph.Skids)
            {
                var skidSegs = graph.Segments.Where(s => skid.SegmentIds.Contains(s.Id)).ToList();
                bool hasDrainPan = skidSegs.Any(s => s.Tag.Equals("segment_CC", StringComparison.OrdinalIgnoreCase) || s.Internals.Any(i => i.Contains("drain", StringComparison.OrdinalIgnoreCase)));
                bool hasFans = skidSegs.Any(s => s.TypeCode.Equals("FE", StringComparison.OrdinalIgnoreCase) || s.TypeCode.Equals("FR", StringComparison.OrdinalIgnoreCase) || s.TypeCode.Equals("FS", StringComparison.OrdinalIgnoreCase));
                bool hasCoils = skidSegs.Any(s => s.TypeCode.Equals("CC", StringComparison.OrdinalIgnoreCase) || s.TypeCode.Equals("HC", StringComparison.OrdinalIgnoreCase));
                bool hasFilters = skidSegs.Any(s => s.TypeCode.Equals("FF", StringComparison.OrdinalIgnoreCase) || s.TypeCode.Equals("RF", StringComparison.OrdinalIgnoreCase) || s.TypeCode.Equals("AF", StringComparison.OrdinalIgnoreCase));
                bool hasHeatWheel = skidSegs.Any(s => s.TypeCode.Equals("HW", StringComparison.OrdinalIgnoreCase));

                // Strict weight semantics: Derived but requires confirmation
                facts[$"skid.{skid.Id}.weight"] = CreateFact(
                    $"skid.{skid.Id}.weight",
                    $"{skid.Name} Aggregate Weight",
                    skid.Name,
                    skid.CalculatedWeight,
                    FactStatus.Derived,
                    FactConfidence.RequiresConfirmation,
                    $"/root:AHU/shippingSkidList/shippingSkid[{skid.Index}]",
                    $"Sum of segments = {skid.CalculatedWeight} lbs. Confirm or override official lifting weight.",
                    derivationName: "Sum of Segment Weights"
                );

                facts[$"skid.{skid.Id}.segmentCount"] = CreateFact(
                    $"skid.{skid.Id}.segmentCount",
                    $"{skid.Name} Segments Count",
                    skid.Name,
                    skid.SegmentIds.Count,
                    FactStatus.Known,
                    FactConfidence.Authoritative
                );

                facts[$"skid.{skid.Id}.hasDrainPan"] = CreateFact(
                    $"skid.{skid.Id}.hasDrainPan",
                    $"{skid.Name} Has Drain Pan",
                    skid.Name,
                    hasDrainPan,
                    FactStatus.Derived,
                    FactConfidence.Authoritative
                );

                facts[$"skid.{skid.Id}.hasFans"] = CreateFact(
                    $"skid.{skid.Id}.hasFans",
                    $"{skid.Name} Has Fans",
                    skid.Name,
                    hasFans,
                    FactStatus.Derived,
                    FactConfidence.Authoritative
                );

                facts[$"skid.{skid.Id}.hasCoils"] = CreateFact(
                    $"skid.{skid.Id}.hasCoils",
                    $"{skid.Name} Has Coils",
                    skid.Name,
                    hasCoils,
                    FactStatus.Derived,
                    FactConfidence.Authoritative
                );

                facts[$"skid.{skid.Id}.hasFilters"] = CreateFact(
                    $"skid.{skid.Id}.hasFilters",
                    $"{skid.Name} Has Filters",
                    skid.Name,
                    hasFilters,
                    FactStatus.Derived,
                    FactConfidence.Authoritative
                );

                facts[$"skid.{skid.Id}.hasHeatWheel"] = CreateFact(
                    $"skid.{skid.Id}.hasHeatWheel",
                    $"{skid.Name} Has Heat Wheel",
                    skid.Name,
                    hasHeatWheel,
                    FactStatus.Derived,
                    FactConfidence.Authoritative
                );
            }

            return facts;
        }

        public void OverrideFact(Dictionary<string, Fact> registry, string key, object? newValue, string author = "Detailer", string? note = null)
        {
            if (!registry.TryGetValue(key, out var current)) return;

            current.OverrideHistory.Add(new FactOverrideEntry
            {
                PreviousValue = current.Value,
                OverriddenBy = author,
                Timestamp = DateTime.UtcNow.ToString("o"),
                Note = note
            });

            current.Value = newValue;
            current.Status = FactStatus.ManuallyOverridden;
            current.Confidence = FactConfidence.Authoritative;
        }

        public void RevertFact(Dictionary<string, Fact> registry, string key)
        {
            if (!registry.TryGetValue(key, out var current)) return;

            current.Value = current.SourceRawValue;
            current.Status = !string.IsNullOrEmpty(current.SourcePointer) ? FactStatus.Known : FactStatus.Derived;
            current.Confidence = FactConfidence.Authoritative;
        }
    }
}
