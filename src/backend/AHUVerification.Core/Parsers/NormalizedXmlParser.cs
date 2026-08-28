using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Xml.Linq;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Parsers
{
    public class NormalizedXmlParser
    {
        private static readonly Dictionary<string, string> SegmentNames = new(StringComparer.OrdinalIgnoreCase)
        {
            ["IP"] = "Inlet Plenum",
            ["FF"] = "Flat Filter",
            ["XA"] = "Access / Inspection",
            ["HW"] = "Heat Wheel (Energy Recovery)",
            ["FE"] = "Fan (Exhaust)",
            ["PC"] = "Pipe Chase",
            ["RF"] = "Rigid / High Efficiency Filter",
            ["HC"] = "Coil (Heating)",
            ["CC"] = "Coil (Cooling)",
            ["FR"] = "Fan (Return)",
            ["FS"] = "Fan (Supply)",
            ["DP"] = "Discharge Plenum",
            ["AT"] = "Sound Attenuator",
            ["MB"] = "Mixing Box",
            ["AF"] = "Angle Filter",
            ["DI"] = "Diffuser",
            ["EB"] = "External Bypass",
            ["EE"] = "Economizer",
            ["EF"] = "Filter Economizer",
            ["EH"] = "Electric Heat",
            ["FD"] = "Face Damper",
            ["HF"] = "HEPA Filter",
            ["HM"] = "Humidifier",
            ["HX"] = "Heat Exchanger",
            ["IB"] = "Internal Bypass",
            ["IC"] = "Integrated Face & Bypass Coil",
            ["IG"] = "Indirect Fired Gas",
            ["IO"] = "Inlet / Outlet",
            ["TN"] = "Turning Section",
            ["UV"] = "UV Light",
            ["VC"] = "Vertical Coil",
            ["VE"] = "Vertical Economizer",
            ["VB"] = "Vestibule / Corridor",
            ["VESTIBULE"] = "Vestibule / Corridor",
            ["VP"] = "Vertical Plenum",
            ["AB"] = "Air Blender"
        };

        public NormalizedXmlGraph Parse(string xmlContent)
        {
            if (string.IsNullOrWhiteSpace(xmlContent))
                throw new ArgumentException("XML content is empty or null.", nameof(xmlContent));

            XDocument doc = XDocument.Parse(xmlContent);
            XElement root = doc.Root ?? throw new InvalidOperationException("XML has no root element.");

            var graph = new NormalizedXmlGraph();

            // Root elements
            graph.UnitMOMID = GetChildText(root, "unit_MOMID", "{00000000-0000-0000-0000-000000000000}");
            graph.UnitWeight = GetChildDouble(root, "unitWeight", 0);
            graph.TotalStaticPressure = GetChildDouble(root, "totalStaticPressure", 0);

            graph.Dimensions = new UnitDimensions
            {
                Length = GetChildDouble(root, "cabLength", 0),
                Height = GetChildDouble(root, "cabHeight", 0),
                Width = GetChildDouble(root, "cabWidth", 0)
            };

            // Document Version
            var docVerNode = FindElement(root, "documentVersion");
            if (docVerNode != null)
            {
                var schemaVerNode = FindElement(docVerNode, "schemaVersion");
                if (schemaVerNode != null)
                {
                    string major = GetChildText(schemaVerNode, "major", "2018");
                    string minor = GetChildText(schemaVerNode, "minor", "9");
                    string build = GetChildText(schemaVerNode, "build", "14");
                    string revision = GetChildText(schemaVerNode, "revision", "1003");
                    graph.DocumentVersion = $"{major}.{minor}.{build}.{revision}";
                }

                var genSoftNode = FindElement(docVerNode, "generatingSoftwareInfo");
                if (genSoftNode != null)
                {
                    string name = GetChildText(genSoftNode, "generatingSoftwareName", "M.O.M. AHU Revision Serializer");
                    var verNode = FindElement(genSoftNode, "generatingSoftwareVersion");
                    string ver = verNode != null ? GetChildText(verNode, "major", "2026") : "2026";
                    graph.GeneratingSoftware = $"{name} v{ver}";
                }
            }

            // Unit Options
            var unitOptNode = FindElement(root, "unitOptions");
            if (unitOptNode != null)
            {
                graph.UnitOptions.UnitType = GetChildText(unitOptNode, "unitType", "Outdoor");
                graph.UnitOptions.BrandOption = GetChildText(unitOptNode, "brandOption", "YORKCustom");
                graph.UnitOptions.UnitConstructionType = GetChildText(unitOptNode, "unitConstructionType", "Standard");
                graph.UnitOptions.ShippingProtection = GetChildText(unitOptNode, "shippingProtection", "ShrinkWrap");
                graph.UnitOptions.IsSeismic = graph.UnitOptions.UnitConstructionType.Equals("IBC", StringComparison.OrdinalIgnoreCase) ||
                                              graph.UnitOptions.UnitConstructionType.Equals("OSHPD", StringComparison.OrdinalIgnoreCase);
                graph.UnitOptions.Noa = graph.UnitOptions.UnitConstructionType.Equals("NOA", StringComparison.OrdinalIgnoreCase);
                graph.UnitOptions.Washdown = GetChildBool(unitOptNode, "washdown", false);
                graph.UnitOptions.Knockdown = GetChildBool(unitOptNode, "knockdown", false);
                graph.UnitOptions.PrimaryAccessSide = GetChildText(unitOptNode, "primaryAccessSide", "Left");
                graph.UnitOptions.DefaultUnitBaseHeight = GetChildDouble(unitOptNode, "defaultUnitBaseHeight", 10);

                var constOptNode = FindElement(unitOptNode, "defaultConstructionOptions");
                if (constOptNode != null)
                {
                    graph.UnitOptions.Materials.ExteriorMaterialType = GetChildText(constOptNode, "exteriorMaterialType", "STL GALV PPC");
                    graph.UnitOptions.Materials.ExteriorMaterialGauge = GetChildInt(constOptNode, "exteriorMaterialGauge", 18);
                    graph.UnitOptions.Materials.InteriorMaterialType = GetChildText(constOptNode, "interiorMaterialType", "STL GALV");
                    graph.UnitOptions.Materials.InteriorMaterialGauge = GetChildInt(constOptNode, "interiorMaterialGauge", 22);
                    graph.UnitOptions.Materials.FloorMaterialType = GetChildText(constOptNode, "floorMaterialType", "STL GALV");
                    
                    string floorGaugeRaw = GetChildText(constOptNode, "floorMaterialGauge", "16");
                    graph.UnitOptions.Materials.FloorMaterialGaugeString = floorGaugeRaw;
                    graph.UnitOptions.Materials.FloorMaterialGauge = int.TryParse(floorGaugeRaw, out int fgInt) ? fgInt : 16;

                    string rawStyle = GetChildText(constOptNode, "housingStyle", "ThermalBreak");
                    graph.UnitOptions.Materials.HousingStyle = rawStyle;
                    graph.UnitOptions.ThermalBreak = rawStyle.Contains("ThermalBreak", StringComparison.OrdinalIgnoreCase) || !rawStyle.Equals("Standard", StringComparison.OrdinalIgnoreCase);
                    graph.UnitOptions.Materials.InsulationType = GetChildText(constOptNode, "insulationType", "Foam");

                    graph.UnitOptions.Materials.ExteriorPaintType = GetChildText(constOptNode, "exteriorPaintType", "None");
                    graph.UnitOptions.Materials.InteriorPaintType = GetChildText(constOptNode, "interiorPaintType", "None");
                    graph.UnitOptions.Materials.FloorPaintType = GetChildText(constOptNode, "floorPaintType", "None");

                    graph.UnitOptions.Materials.HousingThicknessFront = GetChildDouble(constOptNode, "housingThicknessFront", 2.0);
                    graph.UnitOptions.Materials.HousingThicknessRear = GetChildDouble(constOptNode, "housingThicknessRear", 2.0);
                    graph.UnitOptions.Materials.HousingThicknessTop = GetChildDouble(constOptNode, "housingThicknessTop", 2.0);
                    graph.UnitOptions.Materials.HousingThicknessBottom = GetChildDouble(constOptNode, "housingThicknessBottom", 0.0);
                    graph.UnitOptions.Materials.HousingThicknessLeft = GetChildDouble(constOptNode, "housingThicknessLeft", 2.0);
                    graph.UnitOptions.Materials.HousingThicknessRight = GetChildDouble(constOptNode, "housingThicknessRight", 2.0);
                }
            }

            // Roof Options
            var roofNode = FindElement(root, "roofOptions");
            if (roofNode != null)
            {
                graph.RoofOptions.HasSlopedRoof = GetChildBool(roofNode, "hasSlopedRoof", true);
                graph.RoofOptions.RoofSlope = GetChildDouble(roofNode, "roofSlope", 0.25);
                string highSide = GetChildText(roofNode, "roofSlopeHighSide", "Internal");
                graph.RoofOptions.RoofSlopeHighSide = highSide;
                
                if (highSide.Equals("Internal", StringComparison.OrdinalIgnoreCase) || highSide.Equals("Center", StringComparison.OrdinalIgnoreCase))
                    graph.RoofOptions.RoofPeak = "Internal (Center)";
                else if (highSide.Equals("Left", StringComparison.OrdinalIgnoreCase))
                    graph.RoofOptions.RoofPeak = "Left";
                else if (highSide.Equals("Right", StringComparison.OrdinalIgnoreCase))
                    graph.RoofOptions.RoofPeak = "Right";
                else
                    graph.RoofOptions.RoofPeak = graph.RoofOptions.HasSlopedRoof ? "Internal (Center)" : "Flat";

                graph.RoofOptions.RoofPeakZDim = GetChildDouble(roofNode, "roofPeakZDim", 97);
            }

            // Curb Options
            var curbNode = FindElement(root, "curbOptions");
            if (curbNode != null)
            {
                graph.CurbOptions.HasCurbRest = GetChildBool(curbNode, "hasCurbRest", true);
            }

            // Testing Options
            var testNode = FindElement(root, "testingOptions");
            if (testNode != null)
            {
                graph.TestingOptions.DeflectionTest = GetChildText(testNode, "deflectionTest", "None");
                graph.TestingOptions.LeakageTest = GetChildText(testNode, "leakageTest", "None");
                graph.TestingOptions.FanVibrationTest = GetChildText(testNode, "fanVibrationTest", "None");
                graph.TestingOptions.RequireCustomerWitness = GetChildBool(testNode, "requireCustomerWitness", false);
            }

            // Unit Bases
            double maxLipHeight = 0;
            var baseList = FindElement(root, "unitBaseList");
            var baseNodes = baseList != null ? FindElements(baseList, "unitBase") : FindDescendants(root, "unitBase");
            int baseIdx = 1;
            foreach (var b in baseNodes)
            {
                var geom = FindElement(b, "geometry");
                double lipHeight = GetChildDouble(b, "upturnedLipHeight", 0);
                if (lipHeight > maxLipHeight) maxLipHeight = lipHeight;

                double height = geom != null ? GetChildDouble(geom, "yLength", 10) : 10;
                double by = geom != null ? GetChildDouble(geom, "y", 0) : 0;
                bool isUpperBase = by > 15;

                string subMatType = GetChildText(b, "subFloorMaterialType", "STL GALV");
                int subGauge = GetChildInt(b, "subFloorMaterialGauge", 22);
                string subfloorMat = $"{subMatType} {subGauge}ga";

                graph.Bases.Add(new UnitBase
                {
                    Id = GetChildText(b, "unitBaseID", $"base-{baseIdx}"),
                    MaterialType = GetChildText(b, "unitBaseMaterialType", "StructuralSteel"),
                    BaseType = GetChildText(b, "unitBaseType", "A36"),
                    PaintType = GetChildText(b, "unitBasePaintType", "ChampagneBase"),
                    Height = height,
                    LipHeight = lipHeight,
                    InsulationType = GetChildText(b, "insulationType", "Foam_2Inch"),
                    HousingStyle = GetChildText(b, "housingStyle", "ThermalBreak"),
                    HasSubFloor = GetChildBool(b, "hasSubFloor", true),
                    SubFloorMaterial = subfloorMat,
                    SubFloorMaterialType = subMatType,
                    SubFloorMaterialGauge = subGauge,
                    SubFloorPaintType = GetChildText(b, "subFloorPaintType", "None"),
                    FloorAttachmentType = GetChildText(b, "floorAttachmentType", "StitchWeld"),
                    IsUpperBase = isUpperBase,
                    Dimensions = ParseDimensions(geom)
                });
                baseIdx++;
            }
            graph.UnitOptions.LipHeight = maxLipHeight;
            graph.UnitOptions.HasUTL = maxLipHeight > 0;

            // Segments
            var segListNode = FindElement(root, "segmentList");
            var segMap = new Dictionary<string, Segment>(StringComparer.OrdinalIgnoreCase);
            if (segListNode != null)
            {
                int segIdx = 1;
                foreach (var segEl in segListNode.Elements())
                {
                    string tag = segEl.Name.LocalName; // e.g. segment_IP, segment_CC
                    string typeCode = tag.Replace("segment_", "", StringComparison.OrdinalIgnoreCase).ToUpperInvariant();
                    string id = GetChildText(segEl, "segmentID", $"seg-{segIdx}");
                    double weight = GetChildDouble(segEl, "weight", 0);
                    string airPressureType = GetChildText(segEl, "airPressureType", "Negative");
                    double airVolume = GetChildDouble(segEl, "airVolume", 0);
                    string handOrientation = GetChildText(segEl, "handOrientation", "FrontToRear");
                    var geom = FindElement(segEl, "geometry");
                    var parsedGeom = ParseDimensions(geom);

                    // Check elevation for tiered placement
                    double defaultBaseH = graph.UnitOptions.DefaultUnitBaseHeight > 0 ? graph.UnitOptions.DefaultUnitBaseHeight : 10;
                    bool isUpperDeck = parsedGeom.Y > defaultBaseH + 10;
                    bool hasBaseBelowAtSameY = graph.Bases.Any(b => Math.Abs(b.Dimensions.Y - parsedGeom.Y) < 5);
                    bool isTiered = isUpperDeck && !hasBaseBelowAtSameY;
                    int tierLevel = isTiered ? 2 : 1;

                    var constOpt = FindElement(segEl, "constructionOptions");
                    var frontSurfDetail = ParseSurfaceDetail(constOpt, "surfaceDetail_Front", graph.UnitOptions.Materials.ExteriorMaterialType, graph.UnitOptions.Materials.ExteriorMaterialGauge, graph.UnitOptions.Materials.ExteriorPaintType, graph.UnitOptions.Materials.InteriorMaterialType, graph.UnitOptions.Materials.InteriorMaterialGauge, graph.UnitOptions.Materials.InteriorPaintType, graph.UnitOptions.Materials.HousingThicknessFront);
                    var rearSurfDetail = ParseSurfaceDetail(constOpt, "surfaceDetail_Rear", graph.UnitOptions.Materials.ExteriorMaterialType, graph.UnitOptions.Materials.ExteriorMaterialGauge, graph.UnitOptions.Materials.ExteriorPaintType, graph.UnitOptions.Materials.InteriorMaterialType, graph.UnitOptions.Materials.InteriorMaterialGauge, graph.UnitOptions.Materials.InteriorPaintType, graph.UnitOptions.Materials.HousingThicknessRear);
                    var leftSurfDetail = ParseSurfaceDetail(constOpt, "surfaceDetail_Left", graph.UnitOptions.Materials.ExteriorMaterialType, graph.UnitOptions.Materials.ExteriorMaterialGauge, graph.UnitOptions.Materials.ExteriorPaintType, graph.UnitOptions.Materials.InteriorMaterialType, graph.UnitOptions.Materials.InteriorMaterialGauge, graph.UnitOptions.Materials.InteriorPaintType, graph.UnitOptions.Materials.HousingThicknessLeft);
                    var rightSurfDetail = ParseSurfaceDetail(constOpt, "surfaceDetail_Right", graph.UnitOptions.Materials.ExteriorMaterialType, graph.UnitOptions.Materials.ExteriorMaterialGauge, graph.UnitOptions.Materials.ExteriorPaintType, graph.UnitOptions.Materials.InteriorMaterialType, graph.UnitOptions.Materials.InteriorMaterialGauge, graph.UnitOptions.Materials.InteriorPaintType, graph.UnitOptions.Materials.HousingThicknessRight);
                    var topSurfDetail = ParseSurfaceDetail(constOpt, "surfaceDetail_Top", graph.UnitOptions.Materials.ExteriorMaterialType, graph.UnitOptions.Materials.ExteriorMaterialGauge, graph.UnitOptions.Materials.ExteriorPaintType, graph.UnitOptions.Materials.InteriorMaterialType, graph.UnitOptions.Materials.InteriorMaterialGauge, graph.UnitOptions.Materials.InteriorPaintType, graph.UnitOptions.Materials.HousingThicknessTop);
                    var bottomSurfDetail = ParseSurfaceDetail(constOpt, "surfaceDetail_Bottom", graph.UnitOptions.Materials.ExteriorMaterialType, graph.UnitOptions.Materials.FloorMaterialGauge, graph.UnitOptions.Materials.ExteriorPaintType, graph.UnitOptions.Materials.FloorMaterialType, graph.UnitOptions.Materials.FloorMaterialGauge, graph.UnitOptions.Materials.FloorPaintType, 0);

                    var surfaces = new SegmentSurfaces
                    {
                        Front = frontSurfDetail,
                        Rear = rearSurfDetail,
                        Left = leftSurfDetail,
                        Right = rightSurfDetail,
                        Top = topSurfDetail,
                        Bottom = bottomSurfDetail
                    };

                    var frontSurf = constOpt != null ? FindElement(constOpt, "surfaceDetail_Front") : null;

                    string segFloorGaugeRaw = frontSurf != null ? GetChildText(frontSurf, "floorMaterialGauge", graph.UnitOptions.Materials.FloorMaterialGaugeString) : graph.UnitOptions.Materials.FloorMaterialGaugeString;
                    int segFloorGaugeInt = int.TryParse(segFloorGaugeRaw, out int sfg) ? sfg : graph.UnitOptions.Materials.FloorMaterialGauge;

                    var casing = new CasingDetail
                    {
                        ExteriorMaterial = frontSurfDetail.ExteriorMaterial,
                        ExteriorGauge = frontSurfDetail.ExteriorGauge,
                        InteriorMaterial = frontSurfDetail.InteriorMaterial,
                        InteriorGauge = frontSurfDetail.InteriorGauge,
                        FloorMaterial = graph.UnitOptions.Materials.FloorMaterialType,
                        FloorGauge = segFloorGaugeInt,
                        FloorGaugeString = segFloorGaugeRaw,
                        HousingThickness = frontSurfDetail.HousingThickness,
                        HousingThicknessFront = graph.UnitOptions.Materials.HousingThicknessFront,
                        HousingThicknessTop = graph.UnitOptions.Materials.HousingThicknessTop,
                        HousingStyle = constOpt != null ? GetChildText(constOpt, "housingStyle", graph.UnitOptions.Materials.HousingStyle) : graph.UnitOptions.Materials.HousingStyle,
                        InsulationType = constOpt != null ? GetChildText(constOpt, "insulationType", graph.UnitOptions.Materials.InsulationType) : graph.UnitOptions.Materials.InsulationType,
                        ExteriorPaintType = graph.UnitOptions.Materials.ExteriorPaintType,
                        InteriorPaintType = graph.UnitOptions.Materials.InteriorPaintType,
                        FloorPaintType = graph.UnitOptions.Materials.FloorPaintType
                    };

                    // Component sub-tree parsing
                    FanConfig? fanConfig = null;
                    var segFanNode = FindElement(segEl, "segmentConfig_Fan");
                    if (segFanNode != null)
                    {
                        int qH = GetChildInt(segFanNode, "fanArrayQtyHeight", 1);
                        int qW = GetChildInt(segFanNode, "fanArrayQtyWidth", 1);
                        var fanNodes = FindDescendants(segFanNode, "fan");
                        double maxHp = 0;
                        double volt = 460;
                        foreach (var fn in fanNodes)
                        {
                            double hp = GetChildDouble(fn, "motorHorsePower", 0);
                            if (hp > maxHp) maxHp = hp;
                            volt = GetChildDouble(fn, "voltage", 460);
                        }

                        fanConfig = new FanConfig
                        {
                            IsFanArray = GetChildBool(segFanNode, "isFanArray", false) || (qH * qW > 1),
                            ArrayQtyHeight = qH,
                            ArrayQtyWidth = qW,
                            ArrayGrid = $"{qH}x{qW}",
                            HasRedundancy = GetChildBool(segFanNode, "hasFanRedundancy", false),
                            HasStand = GetChildBool(segFanNode, "hasFanStand", false),
                            HasDualFanSeparationWall = GetChildBool(segFanNode, "hasDualFanSeparationWall", false),
                            HasMotorRemovalRail = GetChildBool(segFanNode, "hasMotorRemovalRail", false),
                            IsolationType = GetChildText(segFanNode, "fanFlowIsolationType", "None"),
                            FanCount = fanNodes.Count > 0 ? fanNodes.Count : (qH * qW),
                            MotorHp = maxHp,
                            Voltage = volt
                        };
                    }

                    CoilConfig? coilConfig = null;
                    var segCoilNode = FindElement(segEl, "segmentConfig_Coil");
                    if (segCoilNode != null)
                    {
                        var coilNodes = FindDescendants(segCoilNode, "coil");
                        string hand = "Right";
                        if (coilNodes.Count > 0)
                        {
                            hand = GetChildText(coilNodes[0], "connectionHand", "Right");
                        }

                        coilConfig = new CoilConfig
                        {
                            BulkheadMaterial = GetChildText(segCoilNode, "coilBulkheadMaterial", "STL GALV"),
                            HasStackingRack = GetChildBool(segCoilNode, "hasCoilStackingRack", false),
                            StackingRackMaterial = GetChildText(segCoilNode, "coilStackingRackMaterialType", ""),
                            DripPanMaterial = GetChildText(segCoilNode, "dripPanMaterialType", "StainlessSteel_304"),
                            StaggeredOverlap = GetChildDouble(segCoilNode, "staggeredCoilOverlap", 0),
                            ConnectionHand = hand,
                            CoilCount = coilNodes.Count > 0 ? coilNodes.Count : 1
                        };
                    }

                    FilterConfig? filterConfig = null;
                    var segFilterNode = FindElement(segEl, "segmentConfig_Filter");
                    if (segFilterNode != null)
                    {
                        filterConfig = new FilterConfig
                        {
                            FilterType = typeCode.Contains("RF") ? "RigidFilter" : (typeCode.Contains("AF") ? "AngleFilter" : "FlatFilter"),
                            LoadMethod = GetChildText(segFilterNode, "loadMethod", "FrontLoad"),
                            BulkheadMaterial = GetChildText(segFilterNode, "bulkheadMaterialType", "STL GALV"),
                            GaugeType = GetChildText(segFilterNode, "combinedGaugeType", "None"),
                            GaugeDoorId = GetChildText(segFilterNode, "combinedGaugeDoorID", ""),
                            GaugeMountingType = GetChildText(segFilterNode, "combinedGaugeMountingType", "")
                        };
                    }

                    HeatWheelConfig? heatWheelConfig = null;
                    var segWheelNode = FindElement(segEl, "segmentConfig_HeatWheel");
                    if (segWheelNode != null)
                    {
                        heatWheelConfig = new HeatWheelConfig
                        {
                            Vendor = GetChildText(segWheelNode, "vendor", ""),
                            Model = GetChildText(segWheelNode, "model", ""),
                            WheelType = GetChildText(segWheelNode, "wheelType", "Enthalpy"),
                            MediaType = GetChildText(segWheelNode, "wheelMedia", "MolecularSieve"),
                            HasPurge = GetChildBool(segWheelNode, "hasPurge", false),
                            AllowVariableSpeed = GetChildBool(segWheelNode, "allowVariableSpeed", false),
                            WheelDiameter = GetChildDouble(segWheelNode, "wheelDiameter", 0),
                            RecoveryPercentCFM = GetChildDouble(segWheelNode, "recoveryPercentCFM", 0)
                        };
                    }

                    // Build friendly internals summary
                    var internals = new List<string>();
                    if (coilConfig != null)
                    {
                        internals.Add($"Coil ({coilConfig.BulkheadMaterial} Bulkhead)");
                    }
                    else if (tag.Equals("segment_CC", StringComparison.OrdinalIgnoreCase))
                    {
                        internals.Add("Cooling Coil Wall");
                    }
                    else if (tag.Equals("segment_HC", StringComparison.OrdinalIgnoreCase))
                    {
                        internals.Add("Heating Coil Wall");
                    }

                    if (fanConfig != null)
                    {
                        internals.Add(fanConfig.IsFanArray ? $"Fan Array ({fanConfig.ArrayGrid})" : "Fan Array / Wall");
                    }
                    else if (tag.Equals("segment_FS", StringComparison.OrdinalIgnoreCase) || tag.Equals("segment_FE", StringComparison.OrdinalIgnoreCase) || tag.Equals("segment_FR", StringComparison.OrdinalIgnoreCase))
                    {
                        internals.Add("Fan Array / Wall");
                    }

                    if (heatWheelConfig != null || tag.Equals("segment_HW", StringComparison.OrdinalIgnoreCase)) internals.Add("Heat Recovery Wheel");
                    if (tag.Equals("segment_AT", StringComparison.OrdinalIgnoreCase)) internals.Add("Sound Attenuator Baffles");
                    if (tag.Equals("segment_MB", StringComparison.OrdinalIgnoreCase)) internals.Add("Mixing Dampers");
                    if (tag.Equals("segment_PC", StringComparison.OrdinalIgnoreCase)) internals.Add("Pipe Chase Enclosure");
                    if (filterConfig != null || tag.Contains("FF", StringComparison.OrdinalIgnoreCase) || tag.Contains("RF", StringComparison.OrdinalIgnoreCase) || tag.Contains("AF", StringComparison.OrdinalIgnoreCase))
                    {
                        internals.Add("Filter Rack / Wall");
                    }

                    string friendlyName = SegmentNames.TryGetValue(typeCode, out var friendlyVal) ? friendlyVal : $"Segment {typeCode}";

                    var segment = new Segment
                    {
                        Id = id,
                        Tag = tag,
                        TypeCode = typeCode,
                        Name = friendlyName,
                        Weight = weight,
                        AirPressureType = airPressureType,
                        AirVolume = airVolume,
                        HandOrientation = handOrientation,
                        Dimensions = parsedGeom,
                        Casing = casing,
                        Surfaces = surfaces,
                        Internals = internals,
                        HasFrontChannel = GetChildBool(segEl, "hasFrontChannel", false),
                        HasRearChannel = GetChildBool(segEl, "hasRearChannel", false),
                        HasMotorRemovalRail = GetChildBool(segEl, "hasMotorRemovalRail", false),
                        IsTiered = isTiered,
                        TierLevel = tierLevel,
                        ElevationY = parsedGeom.Y,
                        FanConfig = fanConfig,
                        CoilConfig = coilConfig,
                        FilterConfig = filterConfig,
                        HeatWheelConfig = heatWheelConfig
                    };

                    graph.Segments.Add(segment);
                    segMap[id] = segment;
                    segIdx++;
                }
            }

            // Parse Opening List (<openingList>)
            var openingListNode = FindElement(root, "openingList");
            if (openingListNode != null)
            {
                int opIdx = 1;
                bool isFloorAl = graph.UnitOptions.Materials.FloorMaterialType.Contains("AL", StringComparison.OrdinalIgnoreCase);
                double defaultDrainHoleDia = isFloorAl ? 3.125 : 1.50;

                foreach (var opEl in openingListNode.Elements())
                {
                    string opType = GetChildText(opEl, "openingType", "Standard");
                    string segId = GetChildText(opEl, "segmentID", "");
                    string side = GetChildText(opEl, "unitSide", "Front");
                    var opGeom = ParseDimensions(FindElement(opEl, "geometry"));

                    double width = Math.Max(opGeom.XLength, opGeom.ZLength);
                    double height = opGeom.YLength;

                    // 1. Doors
                    var doorListEl = FindElement(opEl, "doorList");
                    var doorEl = doorListEl != null ? FindElement(doorListEl, "door") : null;
                    if (doorEl != null || opType.Equals("Door", StringComparison.OrdinalIgnoreCase))
                    {
                        var door = new UnitDoor
                        {
                            Id = doorEl != null ? GetChildText(doorEl, "doorID", $"door-{opIdx}") : $"door-{opIdx}",
                            SegmentId = segId,
                            UnitSide = side,
                            Width = width > 0 ? width : 24.0,
                            Height = height > 0 ? height : 72.0,
                            Swing = doorEl != null ? GetChildText(doorEl, "swingDirection", "Out") : "Out",
                            HingeSide = doorEl != null ? GetChildText(doorEl, "doorHingeType", "Left") : "Left",
                            HasWindow = doorEl != null && GetChildBool(doorEl, "hasWindow", false),
                            HasViewPort = doorEl != null && GetChildBool(doorEl, "hasViewPort", false),
                            LatchType = doorEl != null ? GetChildText(doorEl, "doorLatchType", "Standard") : "Standard",
                            DoorType = doorEl != null ? GetChildText(doorEl, "doorType", "Standard") : "Standard"
                        };
                        graph.Doors.Add(door);
                        if (segMap.TryGetValue(segId, out var seg))
                        {
                            seg.Doors.Add(door);
                        }
                    }

                    // 2. Dampers
                    var damperListEl = FindElement(opEl, "damperList");
                    var damperEl = damperListEl != null ? FindElement(damperListEl, "damper") : null;
                    if (damperEl != null)
                    {
                        var damper = new UnitDamper
                        {
                            Id = GetChildText(damperEl, "damper_MOMID", $"damper-{opIdx}"),
                            SegmentId = segId,
                            UnitSide = side,
                            Width = width,
                            Height = height,
                            Depth = GetChildDouble(damperEl, "damperDepth", 0),
                            DamperType = GetChildText(damperEl, "damperType", "Standard"),
                            ActuatorType = GetChildText(damperEl, "actuatorType", "None"),
                            BladeType = GetChildText(damperEl, "bladeType", "Airfoil"),
                            HasAttachedLouver = GetChildBool(damperEl, "louverHasAttachedDamper", false)
                        };
                        graph.Dampers.Add(damper);
                        if (segMap.TryGetValue(segId, out var seg))
                        {
                            seg.Dampers.Add(damper);
                        }
                    }

                    // 3. Floor Drains
                    var fdListEl = FindElement(opEl, "floorDrainList");
                    var fdEl = fdListEl != null ? FindElement(fdListEl, "floorDrain") : null;
                    if (fdEl != null || opType.Equals("FloorDrain", StringComparison.OrdinalIgnoreCase))
                    {
                        var fd = new UnitFloorDrain
                        {
                            Id = fdEl != null ? GetChildText(fdEl, "floorDrain_MOMID", $"fd-{opIdx}") : $"fd-{opIdx}",
                            SegmentId = segId,
                            UnitSide = side,
                            Type = fdEl != null ? GetChildText(fdEl, "floorDrainType", "Standard") : "Standard",
                            PipingMaterial = fdEl != null ? GetChildText(fdEl, "pipingMaterial", "StainlessSteel") : "StainlessSteel",
                            ConnectionDiameter = fdEl != null ? GetChildDouble(fdEl, "connectionDiameter", 1.25) : 1.25,
                            HoleDiameter = defaultDrainHoleDia,
                            ConnectionSide = fdEl != null ? GetChildText(fdEl, "connectionSide", "Left") : "Left",
                            Geometry = opGeom
                        };
                        graph.FloorDrains.Add(fd);
                        if (segMap.TryGetValue(segId, out var seg))
                        {
                            seg.FloorDrains.Add(fd);
                        }
                    }

                    // 4. Duct Openings
                    if (opType.Equals("Standard", StringComparison.OrdinalIgnoreCase))
                    {
                        var duct = new UnitDuctOpening
                        {
                            Id = $"duct-{opIdx}",
                            SegmentId = segId,
                            UnitSide = side,
                            Width = width,
                            Height = height,
                            Shape = GetChildText(opEl, "shape", "Rectangle"),
                            AirType = GetChildText(opEl, "airType", "Supply"),
                            DuctType = GetChildText(opEl, "ductType", "Sleeved")
                        };
                        if (segMap.TryGetValue(segId, out var seg))
                        {
                            seg.DuctOpenings.Add(duct);
                        }
                    }

                    // 5. Drain Pan Openings
                    if (opType.Equals("DrainPan", StringComparison.OrdinalIgnoreCase))
                    {
                        var dpOp = new UnitDrainPanOpening
                        {
                            Id = $"dpan-{opIdx}",
                            SegmentId = segId,
                            Width = width,
                            Length = opGeom.XLength > 0 ? opGeom.XLength : opGeom.ZLength,
                            Depth = opGeom.YLength
                        };
                        if (segMap.TryGetValue(segId, out var seg))
                        {
                            seg.DrainPanOpenings.Add(dpOp);
                        }
                    }

                    opIdx++;
                }
            }

            // Set unit-level aggregations
            graph.IsTiered = graph.Segments.Any(s => s.IsTiered);
            graph.IsStacked = graph.Bases.Any(b => b.IsUpperBase);
            graph.HasFloorDrains = graph.FloorDrains.Count > 0;

            // Shipping Skids
            var skidList = FindElement(root, "shippingSkidList");
            var skidNodes = skidList != null ? FindElements(skidList, "shippingSkid") : FindDescendants(root, "shippingSkid");
            int skidIdx = 1;
            foreach (var s in skidNodes)
            {
                var segRefs = FindDescendants(s, "segmentReference").Select(r => GetChildText(r, "segmentID", "")).Where(id => !string.IsNullOrEmpty(id)).ToList();
                var baseRefs = FindDescendants(s, "unitBaseReference").Select(r => GetChildText(r, "unitBaseID", "")).Where(id => !string.IsNullOrEmpty(id)).ToList();

                double skidCalcWeight = 0;
                double maxLen = 0;
                double maxW = 0;
                double maxH = 0;

                foreach (var sid in segRefs)
                {
                    if (segMap.TryGetValue(sid, out var seg))
                    {
                        skidCalcWeight += seg.Weight;
                        maxLen += seg.Dimensions.XLength;
                        maxW = Math.Max(maxW, seg.Dimensions.ZLength);
                        maxH = Math.Max(maxH, seg.Dimensions.YLength);
                    }
                }

                foreach (var bid in baseRefs)
                {
                    var b = graph.Bases.FirstOrDefault(x => x.Id.Equals(bid, StringComparison.OrdinalIgnoreCase));
                    if (b != null)
                    {
                        maxH += b.Height;
                    }
                }

                graph.Skids.Add(new ShippingSkid
                {
                    Id = $"skid-{skidIdx}",
                    Index = skidIdx,
                    Name = $"Skid {skidIdx}",
                    SegmentIds = segRefs,
                    BaseIds = baseRefs,
                    CalculatedWeight = skidCalcWeight,
                    AuthoritativeWeight = null,
                    IsWeightConfirmed = false,
                    Dimensions = new SkidDimensions
                    {
                        Length = maxLen > 0 ? maxLen : 120,
                        Width = maxW > 0 ? maxW : 80,
                        Height = maxH > 0 ? maxH : 110
                    }
                });
                skidIdx++;
            }

            // Motor Controls
            var mcList = FindElement(root, "motorControlList");
            var mcNodes = mcList != null ? FindElements(mcList, "motorControl") : FindDescendants(root, "motorControl");
            int mcIdx = 1;
            foreach (var m in mcNodes)
            {
                var svcList = FindElement(m, "serviceSegmentReferenceList");
                string? svcId = svcList != null ? GetChildText(svcList, "segmentID", null) : GetChildText(m, "segmentID", null);

                graph.MotorControls.Add(new MotorControl
                {
                    Name = GetChildText(m, "userDefinedName", $"Motor Control {mcIdx}"),
                    UnitSide = GetChildText(m, "unitSide", "Left"),
                    MotorControlType = GetChildText(m, "motorControlType", "ExternalWireDisconnect"),
                    Fla = GetChildDouble(m, "fla", 0),
                    Voltage = GetChildDouble(m, "voltage", 460),
                    Hp = GetChildDouble(m, "horsePower", 0),
                    DisconnectSize = GetChildDouble(m, "disconnectSize", 30),
                    Weight = GetChildDouble(m, "weight", 10),
                    ServiceSegmentId = svcId
                });
                mcIdx++;
            }

            return graph;
        }

        private static Dimensions ParseDimensions(XElement? geom)
        {
            if (geom == null) return new Dimensions();
            return new Dimensions
            {
                X = GetChildDouble(geom, "x", 0),
                Y = GetChildDouble(geom, "y", 0),
                Z = GetChildDouble(geom, "z", 0),
                XLength = GetChildDouble(geom, "xLength", 0),
                YLength = GetChildDouble(geom, "yLength", 0),
                ZLength = GetChildDouble(geom, "zLength", 0)
            };
        }

        private static SurfaceDetail ParseSurfaceDetail(XElement? constOpt, string surfaceTagName, string defaultExtMat, int defaultExtGa, string defaultExtPaint, string defaultIntMat, int defaultIntGa, string defaultIntPaint, double defaultHousingThk)
        {
            var node = constOpt != null ? FindElement(constOpt, surfaceTagName) : null;
            return new SurfaceDetail
            {
                ExteriorMaterial = node != null ? GetChildText(node, "exteriorMaterialType", defaultExtMat) : defaultExtMat,
                ExteriorGauge = node != null ? GetChildInt(node, "exteriorMaterialGauge", defaultExtGa) : defaultExtGa,
                ExteriorPaint = node != null ? GetChildText(node, "exteriorPaintType", defaultExtPaint) : defaultExtPaint,
                InteriorMaterial = node != null ? GetChildText(node, "interiorMaterialType", defaultIntMat) : defaultIntMat,
                InteriorGauge = node != null ? GetChildInt(node, "interiorMaterialGauge", defaultIntGa) : defaultIntGa,
                InteriorPaint = node != null ? GetChildText(node, "interiorPaintType", defaultIntPaint) : defaultIntPaint,
                HousingThickness = node != null ? GetChildDouble(node, "housingThickness", defaultHousingThk) : defaultHousingThk
            };
        }

        private static XElement? FindElement(XElement parent, string localName)
        {
            return parent.Elements().FirstOrDefault(e => e.Name.LocalName.Equals(localName, StringComparison.OrdinalIgnoreCase));
        }

        private static List<XElement> FindElements(XElement parent, string localName)
        {
            return parent.Elements().Where(e => e.Name.LocalName.Equals(localName, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        private static List<XElement> FindDescendants(XElement parent, string localName)
        {
            return parent.Descendants().Where(e => e.Name.LocalName.Equals(localName, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        private static string GetChildText(XElement parent, string localName, string? defaultVal = "")
        {
            var el = FindElement(parent, localName);
            return el?.Value?.Trim() ?? defaultVal ?? "";
        }

        private static double GetChildDouble(XElement parent, string localName, double defaultVal = 0)
        {
            string txt = GetChildText(parent, localName);
            return double.TryParse(txt, NumberStyles.Any, CultureInfo.InvariantCulture, out double val) ? val : defaultVal;
        }

        private static int GetChildInt(XElement parent, string localName, int defaultVal = 0)
        {
            string txt = GetChildText(parent, localName);
            return int.TryParse(txt, NumberStyles.Any, CultureInfo.InvariantCulture, out int val) ? val : defaultVal;
        }

        private static bool GetChildBool(XElement parent, string localName, bool defaultVal = false)
        {
            string txt = GetChildText(parent, localName).ToLowerInvariant();
            if (txt == "true" || txt == "1" || txt == "yes") return true;
            if (txt == "false" || txt == "0" || txt == "no") return false;
            return defaultVal;
        }
    }
}
