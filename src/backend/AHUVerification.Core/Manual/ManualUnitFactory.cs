using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security;
using System.Text;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;

namespace AHUVerification.Core.Manual
{
    public class ManualUnitFactory
    {
        public static readonly List<SegmentTemplate> AvailableSegmentTemplates = new()
        {
            // Plenums & Inlets
            new SegmentTemplate { TypeCode = "IP", Name = "Inlet Plenum", Category = "Plenums & Inlets", DefaultLength = 48, DefaultWeight = 1200, DefaultPressure = "Negative", DefaultInternals = new List<string>(), Description = "Intake air entrance section with optional bottom or side openings" },
            new SegmentTemplate { TypeCode = "MB", Name = "Mixing Box", Category = "Plenums & Inlets", DefaultLength = 60, DefaultWeight = 2200, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Damper Wall (Return & Outside Air)" }, Description = "Outside air and return air mixing plenum with opposing damper blades" },
            new SegmentTemplate { TypeCode = "EE", Name = "Economizer Section", Category = "Plenums & Inlets", DefaultLength = 48, DefaultWeight = 1600, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Economizer Dampers" }, Description = "Full air economizer damper section for free-cooling operation" },
            new SegmentTemplate { TypeCode = "DP", Name = "Discharge Plenum", Category = "Plenums & Inlets", DefaultLength = 48, DefaultWeight = 1400, DefaultPressure = "Positive", DefaultInternals = new List<string>(), Description = "Final discharge section with top, front, or side supply duct collar" },

            // Filtration
            new SegmentTemplate { TypeCode = "FF", Name = "Flat Filter", Category = "Filtration", DefaultLength = 24, DefaultWeight = 800, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Flat Filter (2\" MERV 8 Pre-Filters)" }, Description = "Standard flat pre-filter rack with slide-out side access" },
            new SegmentTemplate { TypeCode = "AF", Name = "Angle Filter", Category = "Filtration", DefaultLength = 36, DefaultWeight = 1100, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Angle Filter (V-Bank Filter Rack)" }, Description = "V-bank angled filter arrangement offering increased face area" },
            new SegmentTemplate { TypeCode = "RF", Name = "Rigid / Bag Filter", Category = "Filtration", DefaultLength = 36, DefaultWeight = 1200, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Rigid Filter (MERV 13-14 Final Filters)" }, Description = "High-efficiency 12\" rigid cartridge or multi-pocket bag filters" },
            new SegmentTemplate { TypeCode = "HF", Name = "HEPA Filter", Category = "Filtration", DefaultLength = 36, DefaultWeight = 1400, DefaultPressure = "Negative", DefaultInternals = new List<string> { "HEPA Filter Wall (99.97% DOP)" }, Description = "Gel-seal or gasket-seal HEPA filter bank for critical healthcare applications" },

            // Coils & Heat Transfer
            new SegmentTemplate { TypeCode = "CC", Name = "Coil (Cooling)", Category = "Coils & Heat Transfer", DefaultLength = 48, DefaultWeight = 2800, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Coil (Cooling)", "Stainless Steel Drain Pan", "Moisture Eliminator" }, Description = "Chilled water or DX cooling coil section with sloped drain pan" },
            new SegmentTemplate { TypeCode = "HC", Name = "Coil (Heating)", Category = "Coils & Heat Transfer", DefaultLength = 36, DefaultWeight = 2200, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Coil (Heating)" }, Description = "Hot water or steam distribution coil with intermediate bulkhead" },
            new SegmentTemplate { TypeCode = "VC", Name = "Vertical Coil", Category = "Coils & Heat Transfer", DefaultLength = 48, DefaultWeight = 2600, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Vertical Coil", "Stacked Drain Pan" }, Description = "Multi-deck vertical face-split cooling or heating coil section" },
            new SegmentTemplate { TypeCode = "IC", Name = "Integrated Face & Bypass Coil", Category = "Coils & Heat Transfer", DefaultLength = 54, DefaultWeight = 3000, DefaultPressure = "Negative", DefaultInternals = new List<string> { "IFB Coil (Face & Bypass Dampers)" }, Description = "Freeze-resistant coil with internal proportional bypass dampers" },

            // Fans & Air Movement
            new SegmentTemplate { TypeCode = "FS", Name = "Fan (Supply)", Category = "Fans & Air Movement", DefaultLength = 72, DefaultWeight = 3800, DefaultPressure = "Positive", DefaultInternals = new List<string> { "EBM Fan Wall Array", "Backdraft Dampers", "Service Light" }, Description = "Supply fan array plenum with ECM direct-drive fans and piezometer rings" },
            new SegmentTemplate { TypeCode = "FR", Name = "Fan (Return)", Category = "Fans & Air Movement", DefaultLength = 60, DefaultWeight = 3400, DefaultPressure = "Negative", DefaultInternals = new List<string> { "EBM Fan Wall Array" }, Description = "Return air fan array configured for building static pressure relief" },
            new SegmentTemplate { TypeCode = "FE", Name = "Fan (Exhaust)", Category = "Fans & Air Movement", DefaultLength = 60, DefaultWeight = 3400, DefaultPressure = "Negative", DefaultInternals = new List<string> { "EBM Fan Wall Array" }, Description = "Dedicated exhaust / spill fan section for 100% outside air systems" },

            // Energy Recovery
            new SegmentTemplate { TypeCode = "HW", Name = "Heat Wheel", Category = "Energy Recovery", DefaultLength = 48, DefaultWeight = 3500, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Heat Wheel (Total Energy Recovery Rotor)", "Purge Sector" }, Description = "Rotary desiccant or sensible energy recovery heat wheel cassette" },
            new SegmentTemplate { TypeCode = "HX", Name = "Plate Heat Exchanger", Category = "Energy Recovery", DefaultLength = 48, DefaultWeight = 3200, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Fixed Plate Heat Exchanger Core" }, Description = "Cross-flow or counter-flow fixed aluminum plate air-to-air heat exchanger" },

            // Access & Service
            new SegmentTemplate { TypeCode = "XA", Name = "Access Section", Category = "Access & Service", DefaultLength = 30, DefaultWeight = 900, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Access Door & Service Space", "Marine Inspection Window" }, Description = "Walk-in service access corridor between coils and fan sections" },
            new SegmentTemplate { TypeCode = "VB", Name = "Vestibule / Service Corridor", Category = "Access & Service", DefaultLength = 48, DefaultWeight = 1400, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Service Corridor", "Electrical Raceway Channel" }, Description = "Enclosed weather-tight service vestibule for piping and controls" },
            new SegmentTemplate { TypeCode = "PC", Name = "Pipe Chase", Category = "Access & Service", DefaultLength = 24, DefaultWeight = 700, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Internal Piping Chase" }, Description = "Dedicated insulated vertical/horizontal internal enclosure for water and refrigerant headers" },

            // Acoustics & Airflow
            new SegmentTemplate { TypeCode = "AT", Name = "Sound Attenuator", Category = "Acoustics & Airflow", DefaultLength = 48, DefaultWeight = 2000, DefaultPressure = "Positive", DefaultInternals = new List<string> { "Sound Attenuator Baffles (Acoustic Silencer)" }, Description = "Silencer section with perforated acoustic splitters for supply noise reduction" },
            new SegmentTemplate { TypeCode = "DI", Name = "Diffuser", Category = "Acoustics & Airflow", DefaultLength = 36, DefaultWeight = 1100, DefaultPressure = "Positive", DefaultInternals = new List<string> { "Perforated Air Distribution Baffle" }, Description = "Airflow velocity equalization diffuser plate behind fan discharge" },

            // Auxiliary & Heaters
            new SegmentTemplate { TypeCode = "EH", Name = "Electric Heat", Category = "Auxiliary & Heaters", DefaultLength = 36, DefaultWeight = 1500, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Electric Heater Grid", "High-Limit Thermal Cutout" }, Description = "Open-coil or finned tubular electric resistance heating element section" },
            new SegmentTemplate { TypeCode = "IG", Name = "Indirect Gas Burner", Category = "Auxiliary & Heaters", DefaultLength = 60, DefaultWeight = 3200, DefaultPressure = "Negative", DefaultInternals = new List<string> { "Indirect Gas Heat Exchanger Drum & Tubes", "Power Burner Assembly" }, Description = "High-turndown stainless steel drum and tube indirect gas heating section" },
            new SegmentTemplate { TypeCode = "UV", Name = "UV-C Disinfection", Category = "Auxiliary & Heaters", DefaultLength = 24, DefaultWeight = 600, DefaultPressure = "Negative", DefaultInternals = new List<string> { "UV-C Germicidal Light Array", "Door Interlock Safety Switches" }, Description = "Ultraviolet surface and airstream irradiation array downstream of cooling coil" },
            new SegmentTemplate { TypeCode = "HM", Name = "Humidifier", Category = "Auxiliary & Heaters", DefaultLength = 36, DefaultWeight = 1200, DefaultPressure = "Positive", DefaultInternals = new List<string> { "Steam Dispersion Tube Grid", "Condensate Drain" }, Description = "Direct steam injection or evaporative media humidification section" }
        };

        public ManualSynthesisResult Synthesize(ManualUnitConfig config)
        {
            if (config == null) throw new ArgumentNullException(nameof(config));

            double defaultBaseHeight = config.DefaultBaseHeight ?? config.BaseHeight ?? 10.0;
            double defaultWallThickness = config.DefaultWallThickness ?? config.WallThickness ?? 2.0;
            double defaultWidth = config.DefaultUnitWidth ?? 84.0;
            double defaultHeight = config.DefaultUnitHeight ?? 96.0;
            double totalStaticPressure = config.TotalStaticPressure ?? 2.5;

            var casingMaterials = new
            {
                ExteriorMaterialType = config.CasingMaterials?.ExteriorMaterialType ?? "STL GALV PPC",
                ExteriorMaterialGauge = config.CasingMaterials?.ExteriorMaterialGauge ?? 18,
                InteriorMaterialType = config.CasingMaterials?.InteriorMaterialType ?? "STL GALV",
                InteriorMaterialGauge = config.CasingMaterials?.InteriorMaterialGauge ?? 22,
                FloorMaterialType = config.CasingMaterials?.FloorMaterialType ?? "STL GALV",
                FloorMaterialGauge = config.CasingMaterials?.FloorMaterialGauge ?? 16,
                HousingStyle = !string.IsNullOrEmpty(config.HousingStyle) ? config.HousingStyle : (config.CasingMaterials?.HousingStyle ?? "ThermalBreak"),
                InsulationType = config.CasingMaterials?.InsulationType ?? "Foam"
            };

            // Determine skids
            List<ManualSkidItem> rawSkids = config.Skids != null && config.Skids.Count > 0
                ? config.Skids
                : new List<ManualSkidItem>();

            if (rawSkids.Count == 0)
            {
                int count = Math.Max(1, config.SkidCount ?? 2);
                for (int i = 0; i < count; i++)
                {
                    rawSkids.Add(new ManualSkidItem
                    {
                        Id = $"skid-{i + 1}",
                        Index = i + 1,
                        Name = $"Skid {i + 1}",
                        BaseHeight = defaultBaseHeight,
                        BaseMaterial = "StructuralSteel",
                        BaseType = "A36",
                        HasSubFloor = true,
                        SubFloorMaterial = "STL GALV 22ga"
                    });
                }
            }

            // Determine segments
            List<ManualSegmentItem> rawSegments = config.Segments != null && config.Segments.Count > 0
                ? config.Segments
                : new List<ManualSegmentItem>();

            if (rawSegments.Count == 0)
            {
                for (int idx = 0; idx < rawSkids.Count; idx++)
                {
                    bool isFirst = idx == 0;
                    bool isLast = idx == rawSkids.Count - 1;
                    string typeCode = isFirst ? "IP" : (isLast ? "FS" : "XA");
                    string name = isFirst ? "Inlet Plenum" : (isLast ? "Supply Fan Section" : $"Access Section {idx + 1}");

                    rawSegments.Add(new ManualSegmentItem
                    {
                        Id = $"seg-{idx + 1}",
                        TypeCode = typeCode,
                        Name = name,
                        SkidId = rawSkids[idx].Id,
                        Length = isLast ? 72 : 48,
                        Width = defaultWidth,
                        Height = defaultHeight,
                        Weight = isLast ? 3800 : 2200,
                        AirPressureType = isLast ? "Positive" : "Negative",
                        AirVolume = 18000,
                        Internals = isLast ? new List<string> { "EBM Fan Wall Array" } : new List<string>()
                    });
                }
            }

            // 1. Process Segments and cumulative X coordinates
            double currentCumulativeX = 0;
            var segments = new List<Segment>();
            var skidSegmentMap = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            foreach (var s in rawSkids)
            {
                skidSegmentMap[s.Id] = new List<string>();
            }

            for (int idx = 0; idx < rawSegments.Count; idx++)
            {
                var item = rawSegments[idx];
                string segId = !string.IsNullOrEmpty(item.Id) ? item.Id : $"seg-{idx + 1}";
                double segLength = item.Length > 0 ? item.Length : 48.0;
                double segWidth = item.Width.HasValue && item.Width.Value > 0 ? item.Width.Value : defaultWidth;
                double segHeight = item.Height.HasValue && item.Height.Value > 0 ? item.Height.Value : defaultHeight;
                double segWeight = item.Weight > 0 ? item.Weight : 2000.0;

                string targetSkidId = !string.IsNullOrEmpty(item.SkidId) && skidSegmentMap.ContainsKey(item.SkidId)
                    ? item.SkidId
                    : (rawSkids.Count > 0 ? rawSkids[0].Id : "skid-1");

                if (!skidSegmentMap.ContainsKey(targetSkidId))
                {
                    skidSegmentMap[targetSkidId] = new List<string>();
                }
                skidSegmentMap[targetSkidId].Add(segId);

                var casing = new CasingDetail
                {
                    ExteriorMaterial = item.Casing?.ExteriorMaterial ?? casingMaterials.ExteriorMaterialType,
                    ExteriorGauge = item.Casing?.ExteriorGauge ?? casingMaterials.ExteriorMaterialGauge,
                    InteriorMaterial = item.Casing?.InteriorMaterial ?? casingMaterials.InteriorMaterialType,
                    InteriorGauge = item.Casing?.InteriorGauge ?? casingMaterials.InteriorMaterialGauge,
                    HousingThickness = item.Casing?.HousingThickness ?? defaultWallThickness,
                    HousingStyle = item.Casing?.HousingStyle ?? casingMaterials.HousingStyle,
                    InsulationType = item.Casing?.InsulationType ?? casingMaterials.InsulationType
                };

                var defaultSurface = new SurfaceDetail
                {
                    ExteriorMaterial = casing.ExteriorMaterial,
                    ExteriorGauge = casing.ExteriorGauge,
                    ExteriorPaint = "None",
                    InteriorMaterial = casing.InteriorMaterial,
                    InteriorGauge = casing.InteriorGauge,
                    InteriorPaint = "None",
                    HousingThickness = casing.HousingThickness
                };

                var surfaces = new SegmentSurfaces
                {
                    Left = CloneSurface(defaultSurface),
                    Front = CloneSurface(defaultSurface),
                    Right = CloneSurface(defaultSurface),
                    Rear = CloneSurface(defaultSurface),
                    Top = CloneSurface(defaultSurface),
                    Bottom = new SurfaceDetail
                    {
                        ExteriorMaterial = defaultSurface.ExteriorMaterial,
                        ExteriorGauge = casingMaterials.FloorMaterialGauge,
                        ExteriorPaint = "None",
                        InteriorMaterial = casingMaterials.FloorMaterialType,
                        InteriorGauge = casingMaterials.FloorMaterialGauge,
                        InteriorPaint = "None",
                        HousingThickness = 0
                    }
                };

                segments.Add(new Segment
                {
                    Id = segId,
                    Tag = $"segment_{item.TypeCode}",
                    TypeCode = item.TypeCode,
                    Name = !string.IsNullOrEmpty(item.Name) ? item.Name : $"Segment {item.TypeCode}",
                    Weight = segWeight,
                    AirPressureType = item.AirPressureType ?? "Negative",
                    AirVolume = item.AirVolume > 0 ? item.AirVolume : 18000,
                    HandOrientation = item.HandOrientation ?? "FrontToRear",
                    Dimensions = new Dimensions
                    {
                        X = currentCumulativeX,
                        Y = 0,
                        Z = 0,
                        XLength = segLength,
                        YLength = segHeight,
                        ZLength = segWidth
                    },
                    Casing = casing,
                    Surfaces = surfaces,
                    Internals = item.Internals != null ? new List<string>(item.Internals) : new List<string>(),
                    HasFrontChannel = item.HasFrontChannel ?? false,
                    HasRearChannel = item.HasRearChannel ?? false,
                    HasMotorRemovalRail = item.HasMotorRemovalRail ?? false
                });

                currentCumulativeX += segLength;
            }

            // 2. Build Bases and Shipping Skids
            var bases = new List<UnitBase>();
            var skids = new List<ShippingSkid>();

            for (int idx = 0; idx < rawSkids.Count; idx++)
            {
                var skidItem = rawSkids[idx];
                string skidId = !string.IsNullOrEmpty(skidItem.Id) ? skidItem.Id : $"skid-{idx + 1}";
                string baseId = $"base-{idx + 1}";
                double baseHeight = skidItem.BaseHeight ?? defaultBaseHeight;
                var assignedSegIds = skidSegmentMap.TryGetValue(skidId, out var sList) ? sList : new List<string>();
                var assignedSegments = segments.Where(s => assignedSegIds.Contains(s.Id)).ToList();

                double skidLength = 0;
                double maxSegWidth = defaultWidth;
                double maxSegHeight = defaultHeight;
                double calculatedWeight = 0;

                foreach (var seg in assignedSegments)
                {
                    skidLength += seg.Dimensions.XLength;
                    maxSegWidth = Math.Max(maxSegWidth, seg.Dimensions.ZLength);
                    maxSegHeight = Math.Max(maxSegHeight, seg.Dimensions.YLength);
                    calculatedWeight += seg.Weight;
                }

                if (skidLength <= 0) skidLength = 48.0;

                bases.Add(new UnitBase
                {
                    Id = baseId,
                    MaterialType = skidItem.BaseMaterial ?? "StructuralSteel",
                    BaseType = skidItem.BaseType ?? "A36",
                    PaintType = "ChampagneBase",
                    Height = baseHeight,
                    LipHeight = 0,
                    InsulationType = "Foam_2Inch",
                    HousingStyle = casingMaterials.HousingStyle,
                    HasSubFloor = skidItem.HasSubFloor ?? true,
                    SubFloorMaterial = skidItem.SubFloorMaterial ?? "STL GALV 22ga",
                    Dimensions = new Dimensions
                    {
                        X = 0,
                        Y = 0,
                        Z = 0,
                        XLength = skidLength,
                        YLength = baseHeight,
                        ZLength = maxSegWidth
                    }
                });

                skids.Add(new ShippingSkid
                {
                    Id = skidId,
                    Index = idx + 1,
                    Name = !string.IsNullOrEmpty(skidItem.Name) ? skidItem.Name : $"Skid {idx + 1}",
                    SegmentIds = assignedSegIds,
                    BaseIds = new List<string> { baseId },
                    CalculatedWeight = calculatedWeight,
                    AuthoritativeWeight = skidItem.AuthoritativeWeight,
                    IsWeightConfirmed = skidItem.IsWeightConfirmed ?? false,
                    Dimensions = new SkidDimensions
                    {
                        Length = skidLength,
                        Width = maxSegWidth,
                        Height = maxSegHeight + baseHeight
                    }
                });
            }

            // Overall unit metrics
            double totalUnitLength = 0;
            double maxUnitWidth = defaultWidth;
            double maxUnitHeight = defaultHeight;
            double totalUnitWeight = 0;

            foreach (var seg in segments)
            {
                totalUnitLength += seg.Dimensions.XLength;
                maxUnitWidth = Math.Max(maxUnitWidth, seg.Dimensions.ZLength);
                maxUnitHeight = Math.Max(maxUnitHeight, seg.Dimensions.YLength);
                totalUnitWeight += seg.Weight;
            }

            var graph = new NormalizedXmlGraph
            {
                UnitMOMID = "{00000000-0000-0000-0000-000000000000}",
                DocumentVersion = "2026.1.0.0",
                GeneratingSoftware = "AHU Verification Workspace (Manual Entry)",
                UnitWeight = totalUnitWeight > 0 ? totalUnitWeight : skids.Count * 3500.0,
                TotalStaticPressure = totalStaticPressure,
                Dimensions = new UnitDimensions
                {
                    Length = totalUnitLength > 0 ? totalUnitLength : skids.Count * 120.0,
                    Width = maxUnitWidth,
                    Height = maxUnitHeight + defaultBaseHeight
                },
                UnitOptions = new UnitOptions
                {
                    UnitType = config.UnitType ?? "Outdoor",
                    BrandOption = "YORKCustom",
                    UnitConstructionType = "Standard",
                    ShippingProtection = "ShrinkWrap",
                    Washdown = false,
                    Knockdown = false,
                    HasUTL = false,
                    LipHeight = 0,
                    IsSeismic = false,
                    Noa = false,
                    NoaRating = "N/A",
                    ThermalBreak = casingMaterials.HousingStyle == "ThermalBreak",
                    PrimaryAccessSide = "Left",
                    DefaultUnitBaseHeight = defaultBaseHeight
                },
                RoofOptions = new RoofOptions
                {
                    HasSlopedRoof = string.Equals(config.UnitType, "Outdoor", StringComparison.OrdinalIgnoreCase),
                    RoofSlope = 0.25,
                    RoofSlopeHighSide = "Internal",
                    RoofPeak = string.Equals(config.UnitType, "Outdoor", StringComparison.OrdinalIgnoreCase) ? "Center" : "Flat",
                    RoofPeakZDim = 97
                },
                CurbOptions = new CurbOptions
                {
                    HasCurbRest = string.Equals(config.UnitType, "Outdoor", StringComparison.OrdinalIgnoreCase)
                },
                Skids = skids,
                Bases = bases,
                Segments = segments,
                MotorControls = new List<MotorControl>()
            };

            // 3. Extract baseline facts and apply authoritative manual overrides
            var factExtractor = new FactExtractor();
            var facts = factExtractor.ExtractFacts(graph);
            var baselineFacts = CloneFacts(facts);
            var manualOverrides = new Dictionary<string, Fact>(StringComparer.Ordinal);

            string detailer = !string.IsNullOrEmpty(config.DetailerName) ? config.DetailerName : "Detailer";
            string reason = "Manual Project Creation";

            void ApplyManualOverride(string key, object? value)
            {
                string canonicalKey = FactContractValidator.CanonicalizeKey(key);
                if (facts.ContainsKey(canonicalKey))
                {
                    factExtractor.OverrideFact(facts, canonicalKey, value, detailer, reason);
                    manualOverrides[canonicalKey] = facts[canonicalKey];
                }
            }

            ApplyManualOverride("unit.jobName", !string.IsNullOrEmpty(config.JobName) ? config.JobName : "Custom AHU Project");
            ApplyManualOverride("unit.comNumber", !string.IsNullOrEmpty(config.ComNumber) ? config.ComNumber : "COM-000000");
            ApplyManualOverride("unit.detailer", detailer);
            ApplyManualOverride("unit.unitType", !string.IsNullOrEmpty(config.UnitType) ? config.UnitType : "Outdoor");
            ApplyManualOverride("unit.shellType", "ISG");
            ApplyManualOverride("casing.thicknessFront", defaultWallThickness);
            ApplyManualOverride("unit.baseHeight", defaultBaseHeight);
            ApplyManualOverride("unit.totalStaticPressure", totalStaticPressure);
            ApplyManualOverride("casing.exteriorMaterial", casingMaterials.ExteriorMaterialType);
            ApplyManualOverride("casing.exteriorGauge", casingMaterials.ExteriorMaterialGauge);
            ApplyManualOverride("casing.interiorMaterial", casingMaterials.InteriorMaterialType);
            ApplyManualOverride("casing.interiorGauge", casingMaterials.InteriorMaterialGauge);
            ApplyManualOverride("casing.floorMaterial", casingMaterials.FloorMaterialType);
            ApplyManualOverride("casing.floorGauge", casingMaterials.FloorMaterialGauge);

            // 4. Synthesize XML Representation for .dvl and OpenXML persistence
            string rawXml = GenerateManualXml(config, graph, casingMaterials.HousingStyle, casingMaterials.InsulationType,
                casingMaterials.ExteriorMaterialType, casingMaterials.ExteriorMaterialGauge,
                casingMaterials.InteriorMaterialType, casingMaterials.InteriorMaterialGauge,
                casingMaterials.FloorMaterialType, casingMaterials.FloorMaterialGauge,
                defaultBaseHeight);

            string generalComments = $"Manually configured AHU unit with {skids.Count} shipping skids and {segments.Count} segments.";

            return new ManualSynthesisResult
            {
                Graph = graph,
                BaselineFacts = baselineFacts,
                Facts = facts,
                ManualOverrides = manualOverrides,
                RawConfigXml = rawXml,
                GeneralComments = generalComments
            };
        }

        private static string GenerateManualXml(
            ManualUnitConfig config,
            NormalizedXmlGraph graph,
            string housingStyle,
            string insulationType,
            string extMaterial,
            int extGauge,
            string intMaterial,
            int intGauge,
            string floorMaterial,
            int floorGauge,
            double defaultBaseHeight)
        {
            var sb = new StringBuilder();
            sb.AppendLine("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
            string safeJobName = EscapeXmlComment(config.JobName ?? "Custom AHU");
            string safeComNumber = EscapeXmlComment(config.ComNumber ?? "COM-000000");
            sb.AppendLine($"<!-- Manually Created AHU Project: {safeJobName} ({safeComNumber}) -->");
            sb.AppendLine("<AHU>");
            sb.AppendLine(CultureInfo.InvariantCulture, $"  <unitWeight>{graph.UnitWeight}</unitWeight>");
            sb.AppendLine(CultureInfo.InvariantCulture, $"  <totalStaticPressure>{graph.TotalStaticPressure}</totalStaticPressure>");
            sb.AppendLine("  <unitOptions>");
            sb.AppendLine($"    <unitType>{EscapeXml(config.UnitType ?? "Outdoor")}</unitType>");
            sb.AppendLine("    <brandOption>YORKCustom</brandOption>");
            sb.AppendLine(CultureInfo.InvariantCulture, $"    <defaultUnitBaseHeight>{defaultBaseHeight}</defaultUnitBaseHeight>");
            sb.AppendLine("    <defaultConstructionOptions>");
            sb.AppendLine($"      <housingStyle>{EscapeXml(housingStyle)}</housingStyle>");
            sb.AppendLine($"      <insulationType>{EscapeXml(insulationType)}</insulationType>");
            sb.AppendLine($"      <exteriorMaterialType>{EscapeXml(extMaterial)}</exteriorMaterialType>");
            sb.AppendLine(CultureInfo.InvariantCulture, $"      <exteriorMaterialGauge>{extGauge}</exteriorMaterialGauge>");
            sb.AppendLine($"      <interiorMaterialType>{EscapeXml(intMaterial)}</interiorMaterialType>");
            sb.AppendLine(CultureInfo.InvariantCulture, $"      <interiorMaterialGauge>{intGauge}</interiorMaterialGauge>");
            sb.AppendLine($"      <floorMaterialType>{EscapeXml(floorMaterial)}</floorMaterialType>");
            sb.AppendLine(CultureInfo.InvariantCulture, $"      <floorMaterialGauge>{floorGauge}</floorMaterialGauge>");
            sb.AppendLine("    </defaultConstructionOptions>");
            sb.AppendLine("  </unitOptions>");

            sb.AppendLine("  <shippingSkidList>");
            foreach (var sk in graph.Skids)
            {
                sb.AppendLine("    <shippingSkid>");
                sb.AppendLine($"      <skidID>{EscapeXml(sk.Id)}</skidID>");
                sb.AppendLine($"      <name>{EscapeXml(sk.Name)}</name>");
                foreach (var sid in sk.SegmentIds)
                {
                    sb.AppendLine($"      <segmentReference><segmentID>{EscapeXml(sid)}</segmentID></segmentReference>");
                }
                foreach (var bid in sk.BaseIds)
                {
                    sb.AppendLine($"      <unitBaseReference><unitBaseID>{EscapeXml(bid)}</unitBaseID></unitBaseReference>");
                }
                sb.AppendLine("    </shippingSkid>");
            }
            sb.AppendLine("  </shippingSkidList>");

            sb.AppendLine("  <unitBaseList>");
            foreach (var b in graph.Bases)
            {
                sb.AppendLine("    <unitBase>");
                sb.AppendLine($"      <unitBaseID>{EscapeXml(b.Id)}</unitBaseID>");
                sb.AppendLine($"      <unitBaseMaterialType>{EscapeXml(b.MaterialType)}</unitBaseMaterialType>");
                sb.AppendLine($"      <unitBaseType>{EscapeXml(b.BaseType)}</unitBaseType>");
                sb.AppendLine($"      <subFloorMaterialType>{EscapeXml(b.SubFloorMaterial)}</subFloorMaterialType>");
                sb.AppendLine("      <geometry>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"        <yLength>{b.Height}</yLength>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"        <xLength>{b.Dimensions.XLength}</xLength>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"        <zLength>{b.Dimensions.ZLength}</zLength>");
                sb.AppendLine("      </geometry>");
                sb.AppendLine("    </unitBase>");
            }
            sb.AppendLine("  </unitBaseList>");

            sb.AppendLine("  <segmentList>");
            foreach (var s in graph.Segments)
            {
                sb.AppendLine($"    <segment_{EscapeXml(s.TypeCode)}>");
                sb.AppendLine($"      <segmentID>{EscapeXml(s.Id)}</segmentID>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"      <weight>{s.Weight}</weight>");
                sb.AppendLine($"      <airPressureType>{EscapeXml(s.AirPressureType)}</airPressureType>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"      <airVolume>{s.AirVolume}</airVolume>");
                sb.AppendLine("      <geometry>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"        <xLength>{s.Dimensions.XLength}</xLength>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"        <yLength>{s.Dimensions.YLength}</yLength>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"        <zLength>{s.Dimensions.ZLength}</zLength>");
                sb.AppendLine("      </geometry>");
                sb.AppendLine("      <constructionOptions>");
                sb.AppendLine($"        <housingStyle>{EscapeXml(s.Casing.HousingStyle)}</housingStyle>");
                sb.AppendLine($"        <insulationType>{EscapeXml(s.Casing.InsulationType)}</insulationType>");
                sb.AppendLine("        <surfaceDetail_Front>");
                sb.AppendLine($"          <exteriorMaterialType>{EscapeXml(s.Casing.ExteriorMaterial)}</exteriorMaterialType>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"          <exteriorMaterialGauge>{s.Casing.ExteriorGauge}</exteriorMaterialGauge>");
                sb.AppendLine($"          <interiorMaterialType>{EscapeXml(s.Casing.InteriorMaterial)}</interiorMaterialType>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"          <interiorMaterialGauge>{s.Casing.InteriorGauge}</interiorMaterialGauge>");
                sb.AppendLine(CultureInfo.InvariantCulture, $"          <housingThickness>{s.Casing.HousingThickness}</housingThickness>");
                sb.AppendLine("        </surfaceDetail_Front>");
                sb.AppendLine("      </constructionOptions>");
                foreach (var intern in s.Internals)
                {
                    sb.AppendLine($"      <internalFeature>{EscapeXml(intern)}</internalFeature>");
                }
                sb.AppendLine($"    </segment_{EscapeXml(s.TypeCode)}>");
            }
            sb.AppendLine("  </segmentList>");
            sb.Append("</AHU>");

            return sb.ToString();
        }

        private static string EscapeXml(string? value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            return SecurityElement.Escape(value) ?? "";
        }

        private static string EscapeXmlComment(string? value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            var sanitized = value;
            while (sanitized.Contains("--"))
            {
                sanitized = sanitized.Replace("--", "- -");
            }
            if (sanitized.EndsWith('-'))
            {
                sanitized += " ";
            }
            return sanitized;
        }

        private static SurfaceDetail CloneSurface(SurfaceDetail s)
        {
            return new SurfaceDetail
            {
                ExteriorMaterial = s.ExteriorMaterial,
                ExteriorGauge = s.ExteriorGauge,
                ExteriorPaint = s.ExteriorPaint,
                InteriorMaterial = s.InteriorMaterial,
                InteriorGauge = s.InteriorGauge,
                InteriorPaint = s.InteriorPaint,
                HousingThickness = s.HousingThickness
            };
        }

        private static Dictionary<string, Fact> CloneFacts(Dictionary<string, Fact> source)
        {
            var copy = new Dictionary<string, Fact>(source.Count, StringComparer.Ordinal);
            foreach (var kvp in source)
            {
                copy[kvp.Key] = CloneFact(kvp.Value);
            }
            return copy;
        }

        private static Fact CloneFact(Fact f)
        {
            return new Fact
            {
                Key = f.Key,
                Label = f.Label,
                Category = f.Category,
                Value = f.Value,
                Status = f.Status,
                Confidence = f.Confidence,
                SourceRawValue = f.SourceRawValue,
                SourcePointer = f.SourcePointer,
                DerivationName = f.DerivationName,
                PromptNote = f.PromptNote,
                SourceState = f.SourceState,
                OverrideHistory = f.OverrideHistory != null ? new List<FactOverrideEntry>(f.OverrideHistory) : new List<FactOverrideEntry>(),
                AuditHistory = f.AuditHistory != null ? new List<FactAuditEntry>(f.AuditHistory) : new List<FactAuditEntry>(),
                OriginalSnapshot = f.OriginalSnapshot != null ? new FactSnapshot
                {
                    Value = f.OriginalSnapshot.Value,
                    Status = f.OriginalSnapshot.Status,
                    Confidence = f.OriginalSnapshot.Confidence,
                    SourceRawValue = f.OriginalSnapshot.SourceRawValue,
                    SourcePointer = f.OriginalSnapshot.SourcePointer,
                    DerivationName = f.OriginalSnapshot.DerivationName,
                    PromptNote = f.OriginalSnapshot.PromptNote,
                    SourceState = f.OriginalSnapshot.SourceState
                } : null
            };
        }
    }
}
