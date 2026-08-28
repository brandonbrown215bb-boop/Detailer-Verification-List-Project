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

        public Dictionary<string, Fact> ExtractFacts(
            NormalizedXmlGraph graph,
            OrderRevisionData? orderRev = null)
        {
            var facts = new Dictionary<string, Fact>(StringComparer.OrdinalIgnoreCase);

            // ==========================================
            // 1. Order & Identity Domain
            // ==========================================
            bool hasJobName = !string.IsNullOrWhiteSpace(orderRev?.JobName);
            facts["unit.jobName"] = CreateFact(
                "unit.jobName",
                "Job Name",
                "Order & Identity",
                hasJobName ? orderRev!.JobName : "Medical Center Phase 3",
                FactStatus.Known,
                FactConfidence.Authoritative,
                hasJobName ? "/root:OrderRevision/jobName" : null,
                hasJobName ? null : "Enter Job Name from Order Packet"
            );

            facts["unit.comNumber"] = CreateFact(
                "unit.comNumber",
                "COM #",
                "Order & Identity",
                null,
                FactStatus.Unknown,
                FactConfidence.RequiresConfirmation,
                null,
                "Enter COM# from MAPICS (e.g. COM-123456)"
            );

            bool hasOrderNum = !string.IsNullOrWhiteSpace(orderRev?.OrderNumber);
            if (hasOrderNum)
            {
                facts["unit.orderNumber"] = CreateFact(
                    "unit.orderNumber",
                    "Order Number",
                    "Order & Identity",
                    orderRev!.OrderNumber,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    "/root:OrderRevision/orderNumber"
                );
            }

            bool hasTag = !string.IsNullOrWhiteSpace(orderRev?.PrimaryTag);
            if (hasTag)
            {
                facts["unit.tag"] = CreateFact(
                    "unit.tag",
                    "Unit Tag",
                    "Order & Identity",
                    orderRev!.PrimaryTag,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    "/root:OrderRevision/tagList/tag"
                );
            }

            bool hasProductType = !string.IsNullOrWhiteSpace(orderRev?.ProductType);
            if (hasProductType)
            {
                facts["unit.productType"] = CreateFact(
                    "unit.productType",
                    "Product Type",
                    "Order & Identity",
                    orderRev!.ProductType,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    "/root:OrderRevision/productType"
                );
            }

            facts["unit.detailer"] = CreateFact(
                "unit.detailer",
                "Detailer Name",
                "Order & Identity",
                null,
                FactStatus.Unknown,
                FactConfidence.RequiresConfirmation,
                null,
                "Enter Detailer Name"
            );

            facts["unit.date"] = CreateFact(
                "unit.date",
                "Verification Date",
                "Order & Identity",
                DateTime.UtcNow.ToString("yyyy-MM-dd"),
                FactStatus.Known,
                FactConfidence.Authoritative
            );

            // ==========================================
            // 2. Baserail, Curb & Skid Domain
            // ==========================================
            facts["unit.baseHeight"] = CreateFact(
                "unit.baseHeight",
                "Base Height (in)",
                "Baserail & Skid",
                graph.UnitOptions.DefaultUnitBaseHeight,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultUnitBaseHeight"
            );

            facts["unit.curbrest"] = CreateFact(
                "unit.curbrest",
                "Curbrest Option",
                "Baserail & Skid",
                graph.CurbOptions.HasCurbRest,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/curbOptions/hasCurbRest"
            );

            facts["unit.lipHeight"] = CreateFact(
                "unit.lipHeight",
                "Upturned Lip Height (in)",
                "Baserail & Skid",
                graph.UnitOptions.LipHeight,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitBaseList/unitBase/upturnedLipHeight"
            );

            facts["unit.hasUTL"] = CreateFact(
                "unit.hasUTL",
                "Has Upturned Lip",
                "Baserail & Skid",
                graph.UnitOptions.HasUTL,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/unitBaseList/unitBase/upturnedLipHeight",
                derivationName: "LipHeight > 0"
            );

            facts["unit.isTiered"] = CreateFact(
                "unit.isTiered",
                "Is Tiered Unit",
                "Baserail & Skid",
                graph.IsTiered,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/segmentList",
                derivationName: "Upper Tier Segments Detected"
            );

            facts["unit.isStacked"] = CreateFact(
                "unit.isStacked",
                "Is Stacked Unit",
                "Baserail & Skid",
                graph.IsStacked,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/unitBaseList",
                derivationName: "Upper Base Detected"
            );

            facts["unit.hasFloorDrains"] = CreateFact(
                "unit.hasFloorDrains",
                "Unit Has Floor Drains",
                "Baserail & Skid",
                graph.HasFloorDrains,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/openingList"
            );

            // Per-Base Facts
            foreach (var b in graph.Bases)
            {
                facts[$"base.{b.Id}.height"] = CreateFact(
                    $"base.{b.Id}.height",
                    $"{b.Id} Height",
                    "Baserail & Skid",
                    b.Height,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    $"/root:AHU/unitBaseList/unitBase[unitBaseID='{b.Id}']/geometry/yLength"
                );

                facts[$"base.{b.Id}.lipHeight"] = CreateFact(
                    $"base.{b.Id}.lipHeight",
                    $"{b.Id} Lip Height",
                    "Baserail & Skid",
                    b.LipHeight,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    $"/root:AHU/unitBaseList/unitBase[unitBaseID='{b.Id}']/upturnedLipHeight"
                );

                facts[$"base.{b.Id}.hasSubFloor"] = CreateFact(
                    $"base.{b.Id}.hasSubFloor",
                    $"{b.Id} Has Subfloor",
                    "Baserail & Skid",
                    b.HasSubFloor,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    $"/root:AHU/unitBaseList/unitBase[unitBaseID='{b.Id}']/hasSubFloor"
                );

                facts[$"base.{b.Id}.subFloorMaterial"] = CreateFact(
                    $"base.{b.Id}.subFloorMaterial",
                    $"{b.Id} Subfloor Material",
                    "Baserail & Skid",
                    b.SubFloorMaterialType,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    $"/root:AHU/unitBaseList/unitBase[unitBaseID='{b.Id}']/subFloorMaterialType"
                );

                facts[$"base.{b.Id}.subFloorGauge"] = CreateFact(
                    $"base.{b.Id}.subFloorGauge",
                    $"{b.Id} Subfloor Gauge",
                    "Baserail & Skid",
                    b.SubFloorMaterialGauge,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    $"/root:AHU/unitBaseList/unitBase[unitBaseID='{b.Id}']/subFloorMaterialGauge"
                );

                facts[$"base.{b.Id}.subFloorPaint"] = CreateFact(
                    $"base.{b.Id}.subFloorPaint",
                    $"{b.Id} Subfloor Paint",
                    "Baserail & Skid",
                    b.SubFloorPaintType,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    $"/root:AHU/unitBaseList/unitBase[unitBaseID='{b.Id}']/subFloorPaintType"
                );

                facts[$"base.{b.Id}.paintType"] = CreateFact(
                    $"base.{b.Id}.paintType",
                    $"{b.Id} Paint Finish",
                    "Baserail & Skid",
                    b.PaintType,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    $"/root:AHU/unitBaseList/unitBase[unitBaseID='{b.Id}']/unitBasePaintType"
                );

                facts[$"base.{b.Id}.floorAttachment"] = CreateFact(
                    $"base.{b.Id}.floorAttachment",
                    $"{b.Id} Floor Attachment",
                    "Baserail & Skid",
                    b.FloorAttachmentType,
                    FactStatus.Known,
                    FactConfidence.Authoritative,
                    $"/root:AHU/unitBaseList/unitBase[unitBaseID='{b.Id}']/floorAttachmentType"
                );

                facts[$"base.{b.Id}.isUpperBase"] = CreateFact(
                    $"base.{b.Id}.isUpperBase",
                    $"{b.Id} Is Upper Base",
                    "Baserail & Skid",
                    b.IsUpperBase,
                    FactStatus.Derived,
                    FactConfidence.Authoritative,
                    $"/root:AHU/unitBaseList/unitBase[unitBaseID='{b.Id}']/geometry/y"
                );
            }

            // ==========================================
            // 3. Housing, Casing, Materials & Roof Domain
            // ==========================================
            facts["unit.shellType"] = CreateFact(
                "unit.shellType",
                "Shell Type",
                "Housing & Materials",
                graph.UnitOptions.Materials.HousingStyle.Equals("CAD", StringComparison.OrdinalIgnoreCase) ? "CAD" : "ISG",
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/housingStyle"
            );

            facts["unit.unitType"] = CreateFact(
                "unit.unitType",
                "Unit Type",
                "Housing & Materials",
                graph.UnitOptions.UnitType,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/unitType"
            );

            facts["unit.thermalBreak"] = CreateFact(
                "unit.thermalBreak",
                "Thermal Break",
                "Housing & Materials",
                graph.UnitOptions.ThermalBreak,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/housingStyle",
                derivationName: "Housing Style Contains ThermalBreak"
            );

            facts["unit.knockdown"] = CreateFact(
                "unit.knockdown",
                "Knockdown Construction",
                "Housing & Materials",
                graph.UnitOptions.Knockdown,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/knockdown"
            );

            facts["unit.shippingProtection"] = CreateFact(
                "unit.shippingProtection",
                "Shipping Protection",
                "Housing & Materials",
                graph.UnitOptions.ShippingProtection,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/shippingProtection"
            );

            facts["casing.thicknessFront"] = CreateFact(
                "casing.thicknessFront",
                "Front Wall Thickness (in)",
                "Housing & Materials",
                graph.UnitOptions.Materials.HousingThicknessFront,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/housingThicknessFront"
            );

            facts["casing.thicknessTop"] = CreateFact(
                "casing.thicknessTop",
                "Roof Casing Thickness (in)",
                "Housing & Materials",
                graph.UnitOptions.Materials.HousingThicknessTop,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/housingThicknessTop"
            );

            facts["casing.exteriorMaterial"] = CreateFact(
                "casing.exteriorMaterial",
                "Skin Material",
                "Housing & Materials",
                graph.UnitOptions.Materials.ExteriorMaterialType,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/exteriorMaterialType"
            );

            facts["casing.exteriorGauge"] = CreateFact(
                "casing.exteriorGauge",
                "Skin Gauge",
                "Housing & Materials",
                graph.UnitOptions.Materials.ExteriorMaterialGauge,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/exteriorMaterialGauge"
            );

            facts["casing.interiorMaterial"] = CreateFact(
                "casing.interiorMaterial",
                "Liner Material",
                "Housing & Materials",
                graph.UnitOptions.Materials.InteriorMaterialType,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/interiorMaterialType"
            );

            facts["casing.interiorGauge"] = CreateFact(
                "casing.interiorGauge",
                "Liner Gauge",
                "Housing & Materials",
                graph.UnitOptions.Materials.InteriorMaterialGauge,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/interiorMaterialGauge"
            );

            facts["casing.floorMaterial"] = CreateFact(
                "casing.floorMaterial",
                "Floor Material",
                "Housing & Materials",
                graph.UnitOptions.Materials.FloorMaterialType,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/floorMaterialType"
            );

            facts["casing.floorGauge"] = CreateFact(
                "casing.floorGauge",
                "Floor Gauge",
                "Housing & Materials",
                graph.UnitOptions.Materials.FloorMaterialGauge,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/floorMaterialGauge"
            );

            facts["casing.floorGaugeString"] = CreateFact(
                "casing.floorGaugeString",
                "Floor Gauge String",
                "Housing & Materials",
                graph.UnitOptions.Materials.FloorMaterialGaugeString,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/floorMaterialGauge"
            );

            facts["casing.insulationType"] = CreateFact(
                "casing.insulationType",
                "Insulation Type",
                "Housing & Materials",
                graph.UnitOptions.Materials.InsulationType,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/defaultConstructionOptions/insulationType"
            );

            facts["roof.hasSlopedRoof"] = CreateFact(
                "roof.hasSlopedRoof",
                "Has Sloped Roof",
                "Housing & Materials",
                graph.RoofOptions.HasSlopedRoof,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/roofOptions/hasSlopedRoof"
            );

            string peakVal = graph.RoofOptions.RoofPeak;
            if (peakVal.Equals("Center", StringComparison.OrdinalIgnoreCase) || peakVal.Equals("Internal", StringComparison.OrdinalIgnoreCase))
            {
                peakVal = "Internal (Center)";
            }
            facts["roof.roofPeak"] = CreateFact(
                "roof.roofPeak",
                "Roof Peak Style",
                "Housing & Materials",
                peakVal,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/roofOptions/roofSlopeHighSide"
            );

            facts["roof.roofSlope"] = CreateFact(
                "roof.roofSlope",
                "Roof Slope (in/ft)",
                "Housing & Materials",
                graph.RoofOptions.RoofSlope,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/roofOptions/roofSlope"
            );

            facts["roof.roofPeakZDim"] = CreateFact(
                "roof.roofPeakZDim",
                "Roof Peak Z Coordinate (in)",
                "Housing & Materials",
                graph.RoofOptions.RoofPeakZDim,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/roofOptions/roofPeakZDim"
            );

            // ==========================================
            // 4. Opening Schedule Domain
            // ==========================================
            facts["opening.totalCount"] = CreateFact(
                "opening.totalCount",
                "Total Openings Count",
                "Opening Schedule",
                graph.Doors.Count + graph.Dampers.Count + graph.FloorDrains.Count,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/openingList"
            );

            facts["door.totalCount"] = CreateFact(
                "door.totalCount",
                "Total Access Doors",
                "Opening Schedule",
                graph.Doors.Count,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/openingList/opening[doorList]"
            );

            facts["damper.totalCount"] = CreateFact(
                "damper.totalCount",
                "Total Dampers",
                "Opening Schedule",
                graph.Dampers.Count,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/openingList/opening[damperList]"
            );

            facts["floorDrain.totalCount"] = CreateFact(
                "floorDrain.totalCount",
                "Total Floor Drains",
                "Opening Schedule",
                graph.FloorDrains.Count,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/openingList/opening[floorDrainList]"
            );

            // Per-Door Facts
            foreach (var d in graph.Doors)
            {
                facts[$"door.{d.Id}.width"] = CreateFact($"door.{d.Id}.width", $"{d.Id} Width", "Opening Schedule", d.Width, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"door.{d.Id}.height"] = CreateFact($"door.{d.Id}.height", $"{d.Id} Height", "Opening Schedule", d.Height, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"door.{d.Id}.swing"] = CreateFact($"door.{d.Id}.swing", $"{d.Id} Swing Direction", "Opening Schedule", d.Swing, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"door.{d.Id}.hingeSide"] = CreateFact($"door.{d.Id}.hingeSide", $"{d.Id} Hinge Side", "Opening Schedule", d.HingeSide, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"door.{d.Id}.hasWindow"] = CreateFact($"door.{d.Id}.hasWindow", $"{d.Id} Has Window", "Opening Schedule", d.HasWindow, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"door.{d.Id}.segmentId"] = CreateFact($"door.{d.Id}.segmentId", $"{d.Id} Host Segment", "Opening Schedule", d.SegmentId, FactStatus.Known, FactConfidence.Authoritative);
            }

            // Per-Damper Facts
            foreach (var d in graph.Dampers)
            {
                facts[$"damper.{d.Id}.type"] = CreateFact($"damper.{d.Id}.type", $"{d.Id} Type", "Opening Schedule", d.DamperType, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"damper.{d.Id}.actuator"] = CreateFact($"damper.{d.Id}.actuator", $"{d.Id} Actuator", "Opening Schedule", d.ActuatorType, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"damper.{d.Id}.width"] = CreateFact($"damper.{d.Id}.width", $"{d.Id} Width", "Opening Schedule", d.Width, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"damper.{d.Id}.height"] = CreateFact($"damper.{d.Id}.height", $"{d.Id} Height", "Opening Schedule", d.Height, FactStatus.Known, FactConfidence.Authoritative);
            }

            // Per-Floor Drain Facts
            foreach (var fd in graph.FloorDrains)
            {
                facts[$"floorDrain.{fd.Id}.type"] = CreateFact($"floorDrain.{fd.Id}.type", $"{fd.Id} Drain Type", "Opening Schedule", fd.Type, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"floorDrain.{fd.Id}.pipingMaterial"] = CreateFact($"floorDrain.{fd.Id}.pipingMaterial", $"{fd.Id} Piping Material", "Opening Schedule", fd.PipingMaterial, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"floorDrain.{fd.Id}.connectionDiameter"] = CreateFact($"floorDrain.{fd.Id}.connectionDiameter", $"{fd.Id} Connection Diameter", "Opening Schedule", fd.ConnectionDiameter, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"floorDrain.{fd.Id}.holeDiameter"] = CreateFact($"floorDrain.{fd.Id}.holeDiameter", $"{fd.Id} Floor Hole Diameter", "Opening Schedule", fd.HoleDiameter, FactStatus.Derived, FactConfidence.Authoritative);
                facts[$"floorDrain.{fd.Id}.segmentId"] = CreateFact($"floorDrain.{fd.Id}.segmentId", $"{fd.Id} Host Segment", "Opening Schedule", fd.SegmentId, FactStatus.Known, FactConfidence.Authoritative);
            }

            // ==========================================
            // 5. Component Sub-Trees Domain
            // ==========================================
            foreach (var s in graph.Segments)
            {
                if (s.FanConfig != null)
                {
                    facts[$"fan.{s.Id}.isFanArray"] = CreateFact($"fan.{s.Id}.isFanArray", $"{s.Id} Is Fan Array", "Components", s.FanConfig.IsFanArray, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"fan.{s.Id}.arrayGrid"] = CreateFact($"fan.{s.Id}.arrayGrid", $"{s.Id} Array Grid", "Components", s.FanConfig.ArrayGrid, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"fan.{s.Id}.hasRedundancy"] = CreateFact($"fan.{s.Id}.hasRedundancy", $"{s.Id} Has Fan Redundancy", "Components", s.FanConfig.HasRedundancy, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"fan.{s.Id}.hasStand"] = CreateFact($"fan.{s.Id}.hasStand", $"{s.Id} Has Fan Stand", "Components", s.FanConfig.HasStand, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"fan.{s.Id}.hasRemovalRail"] = CreateFact($"fan.{s.Id}.hasRemovalRail", $"{s.Id} Has Motor Removal Rail", "Components", s.FanConfig.HasMotorRemovalRail, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"fan.{s.Id}.isolationType"] = CreateFact($"fan.{s.Id}.isolationType", $"{s.Id} Isolation Type", "Components", s.FanConfig.IsolationType, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"fan.{s.Id}.motorHp"] = CreateFact($"fan.{s.Id}.motorHp", $"{s.Id} Motor HP", "Components", s.FanConfig.MotorHp, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"fan.{s.Id}.voltage"] = CreateFact($"fan.{s.Id}.voltage", $"{s.Id} Voltage", "Components", s.FanConfig.Voltage, FactStatus.Known, FactConfidence.Authoritative);
                }

                if (s.CoilConfig != null)
                {
                    facts[$"coil.{s.Id}.bulkheadMaterial"] = CreateFact($"coil.{s.Id}.bulkheadMaterial", $"{s.Id} Bulkhead Material", "Components", s.CoilConfig.BulkheadMaterial, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"coil.{s.Id}.hasStackingRack"] = CreateFact($"coil.{s.Id}.hasStackingRack", $"{s.Id} Has Stacking Rack", "Components", s.CoilConfig.HasStackingRack, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"coil.{s.Id}.dripPanMaterial"] = CreateFact($"coil.{s.Id}.dripPanMaterial", $"{s.Id} Drip Pan Material", "Components", s.CoilConfig.DripPanMaterial, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"coil.{s.Id}.staggeredOverlap"] = CreateFact($"coil.{s.Id}.staggeredOverlap", $"{s.Id} Staggered Overlap", "Components", s.CoilConfig.StaggeredOverlap, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"coil.{s.Id}.connectionHand"] = CreateFact($"coil.{s.Id}.connectionHand", $"{s.Id} Connection Hand", "Components", s.CoilConfig.ConnectionHand, FactStatus.Known, FactConfidence.Authoritative);
                }

                if (s.FilterConfig != null)
                {
                    facts[$"filter.{s.Id}.loadMethod"] = CreateFact($"filter.{s.Id}.loadMethod", $"{s.Id} Load Method", "Components", s.FilterConfig.LoadMethod, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"filter.{s.Id}.bulkheadMaterial"] = CreateFact($"filter.{s.Id}.bulkheadMaterial", $"{s.Id} Bulkhead Material", "Components", s.FilterConfig.BulkheadMaterial, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"filter.{s.Id}.gaugeType"] = CreateFact($"filter.{s.Id}.gaugeType", $"{s.Id} Gauge Type", "Components", s.FilterConfig.GaugeType, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"filter.{s.Id}.gaugeDoorId"] = CreateFact($"filter.{s.Id}.gaugeDoorId", $"{s.Id} Gauge Door ID", "Components", s.FilterConfig.GaugeDoorId, FactStatus.Known, FactConfidence.Authoritative);
                }

                if (s.HeatWheelConfig != null)
                {
                    facts[$"wheel.{s.Id}.hasPurge"] = CreateFact($"wheel.{s.Id}.hasPurge", $"{s.Id} Has Purge Sector", "Components", s.HeatWheelConfig.HasPurge, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"wheel.{s.Id}.mediaType"] = CreateFact($"wheel.{s.Id}.mediaType", $"{s.Id} Wheel Media Type", "Components", s.HeatWheelConfig.MediaType, FactStatus.Known, FactConfidence.Authoritative);
                    facts[$"wheel.{s.Id}.allowVariableSpeed"] = CreateFact($"wheel.{s.Id}.allowVariableSpeed", $"{s.Id} Variable Speed", "Components", s.HeatWheelConfig.AllowVariableSpeed, FactStatus.Known, FactConfidence.Authoritative);
                }
            }

            // Motor Controls
            foreach (var m in graph.MotorControls)
            {
                facts[$"motorControl.{m.Name}.disconnectSize"] = CreateFact($"motorControl.{m.Name}.disconnectSize", $"{m.Name} Disconnect Size (A)", "Components", m.DisconnectSize, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"motorControl.{m.Name}.fla"] = CreateFact($"motorControl.{m.Name}.fla", $"{m.Name} FLA", "Components", m.Fla, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"motorControl.{m.Name}.voltage"] = CreateFact($"motorControl.{m.Name}.voltage", $"{m.Name} Voltage", "Components", m.Voltage, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"motorControl.{m.Name}.hp"] = CreateFact($"motorControl.{m.Name}.hp", $"{m.Name} HP", "Components", m.Hp, FactStatus.Known, FactConfidence.Authoritative);
                facts[$"motorControl.{m.Name}.unitSide"] = CreateFact($"motorControl.{m.Name}.unitSide", $"{m.Name} Unit Side", "Components", m.UnitSide, FactStatus.Known, FactConfidence.Authoritative);
            }

            // ==========================================
            // 6. Ratings & Quality Domain
            // ==========================================
            facts["unit.isSeismic"] = CreateFact(
                "unit.isSeismic",
                "Seismic Certification Required",
                "Ratings & Options",
                graph.UnitOptions.IsSeismic,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/unitConstructionType"
            );

            facts["unit.noa"] = CreateFact(
                "unit.noa",
                "Notice of Acceptance (NOA)",
                "Ratings & Options",
                graph.UnitOptions.Noa,
                FactStatus.Derived,
                FactConfidence.Authoritative,
                "/root:AHU/unitOptions/unitConstructionType"
            );

            facts["unit.deflectionTest"] = CreateFact(
                "unit.deflectionTest",
                "Deflection Testing Spec",
                "Ratings & Options",
                graph.TestingOptions.DeflectionTest,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/testingOptions/deflectionTest"
            );

            facts["unit.totalWeight"] = CreateFact(
                "unit.totalWeight",
                "Total Unit Weight (lbs)",
                "Ratings & Options",
                graph.UnitWeight,
                FactStatus.Known,
                FactConfidence.Authoritative,
                "/root:AHU/unitWeight"
            );

            facts["unit.totalStaticPressure"] = CreateFact(
                "unit.totalStaticPressure",
                "Total Static Pressure (in.w.g.)",
                "Ratings & Options",
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

                var skidBases = graph.Bases.Where(b => skid.BaseIds.Contains(b.Id)).ToList();
                bool hasSubFloor = skidBases.Any(b => b.HasSubFloor);
                int drainCount = skidSegs.Sum(s => s.FloorDrains.Count);

                facts[$"skid.{skid.Id}.weight"] = CreateFact(
                    $"skid.{skid.Id}.weight",
                    $"{skid.Name} Aggregate Weight",
                    skid.Name,
                    skid.CalculatedWeight,
                    FactStatus.Derived,
                    FactConfidence.Authoritative,
                    $"/root:AHU/shippingSkidList/shippingSkid[{skid.Index}]",
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

                facts[$"skid.{skid.Id}.hasSubFloor"] = CreateFact(
                    $"skid.{skid.Id}.hasSubFloor",
                    $"{skid.Name} Has Subfloor",
                    skid.Name,
                    hasSubFloor,
                    FactStatus.Derived,
                    FactConfidence.Authoritative
                );

                facts[$"skid.{skid.Id}.floorDrainCount"] = CreateFact(
                    $"skid.{skid.Id}.floorDrainCount",
                    $"{skid.Name} Floor Drain Count",
                    skid.Name,
                    drainCount,
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
