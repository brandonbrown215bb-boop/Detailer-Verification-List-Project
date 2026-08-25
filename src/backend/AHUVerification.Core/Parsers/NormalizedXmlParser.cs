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
            ["VP"] = "Vertical Plenum"
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
                graph.UnitOptions.IsSeismic = graph.UnitOptions.UnitConstructionType.Equals("IBC", StringComparison.OrdinalIgnoreCase) ||
                                              graph.UnitOptions.UnitConstructionType.Equals("OSHPD", StringComparison.OrdinalIgnoreCase);
                graph.UnitOptions.NoaRating = graph.UnitOptions.UnitConstructionType.Equals("NOA", StringComparison.OrdinalIgnoreCase) ? "NOA" : "N/A";
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
                    graph.UnitOptions.Materials.FloorMaterialGauge = GetChildInt(constOptNode, "floorMaterialGauge", 16);
                    graph.UnitOptions.Materials.HousingStyle = GetChildText(constOptNode, "housingStyle", "ThermalBreak");
                    graph.UnitOptions.Materials.InsulationType = GetChildText(constOptNode, "insulationType", "Foam");
                }
            }

            // Roof Options
            var roofNode = FindElement(root, "roofOptions");
            if (roofNode != null)
            {
                graph.RoofOptions.HasSlopedRoof = GetChildBool(roofNode, "hasSlopedRoof", true);
                graph.RoofOptions.RoofSlope = GetChildDouble(roofNode, "roofSlope", 0.25);
                graph.RoofOptions.RoofSlopeHighSide = GetChildText(roofNode, "roofSlopeHighSide", "Internal");
                graph.RoofOptions.RoofPeakZDim = GetChildDouble(roofNode, "roofPeakZDim", 97);
            }

            // Curb Options
            var curbNode = FindElement(root, "curbOptions");
            if (curbNode != null)
            {
                graph.CurbOptions.HasCurbRest = GetChildBool(curbNode, "hasCurbRest", true);
                graph.CurbOptions.HasCurb = GetChildBool(curbNode, "hasCurb", false);
                graph.CurbOptions.CurbHeight = GetChildDouble(curbNode, "curbHeight", 0);
            }

            // Unit Bases (search inside unitBaseList or descendants)
            bool detectedUtl = false;
            var baseList = FindElement(root, "unitBaseList");
            var baseNodes = baseList != null ? FindElements(baseList, "unitBase") : FindDescendants(root, "unitBase");
            int baseIdx = 1;
            foreach (var b in baseNodes)
            {
                var geom = FindElement(b, "geometry");
                double lipHeight = GetChildDouble(b, "upturnedLipHeight", 0);
                if (lipHeight > 0) detectedUtl = true;

                double height = geom != null ? GetChildDouble(geom, "yLength", 10) : 10;
                string subfloorMat = $"{GetChildText(b, "subFloorMaterialType", "STL GALV")} {GetChildInt(b, "subFloorMaterialGauge", 22)}ga";

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
                    Dimensions = ParseDimensions(geom)
                });
                baseIdx++;
            }
            graph.UnitOptions.HasUTL = detectedUtl;

            // Segments (inside segmentList)
            var segListNode = FindElement(root, "segmentList");
            var segMap = new Dictionary<string, Segment>(StringComparer.OrdinalIgnoreCase);
            if (segListNode != null)
            {
                int segIdx = 1;
                foreach (var segEl in segListNode.Elements())
                {
                    string tag = segEl.Name.LocalName; // e.g. segment_IP
                    string typeCode = tag.Replace("segment_", "", StringComparison.OrdinalIgnoreCase).ToUpperInvariant();
                    string id = GetChildText(segEl, "segmentID", $"seg-{segIdx}");
                    double weight = GetChildDouble(segEl, "weight", 0);
                    string airPressureType = GetChildText(segEl, "airPressureType", "Negative");
                    double airVolume = GetChildDouble(segEl, "airVolume", 0);
                    string handOrientation = GetChildText(segEl, "handOrientation", "FrontToRear");
                    var geom = FindElement(segEl, "geometry");

                    var constOpt = FindElement(segEl, "constructionOptions");
                    var frontSurf = constOpt != null ? FindElement(constOpt, "surfaceDetail_Front") : null;

                    var casing = new CasingDetail
                    {
                        ExteriorMaterial = frontSurf != null ? GetChildText(frontSurf, "exteriorMaterialType", graph.UnitOptions.Materials.ExteriorMaterialType) : graph.UnitOptions.Materials.ExteriorMaterialType,
                        ExteriorGauge = frontSurf != null ? GetChildInt(frontSurf, "exteriorMaterialGauge", graph.UnitOptions.Materials.ExteriorMaterialGauge) : graph.UnitOptions.Materials.ExteriorMaterialGauge,
                        InteriorMaterial = frontSurf != null ? GetChildText(frontSurf, "interiorMaterialType", graph.UnitOptions.Materials.InteriorMaterialType) : graph.UnitOptions.Materials.InteriorMaterialType,
                        InteriorGauge = frontSurf != null ? GetChildInt(frontSurf, "interiorMaterialGauge", graph.UnitOptions.Materials.InteriorMaterialGauge) : graph.UnitOptions.Materials.InteriorMaterialGauge,
                        HousingThickness = frontSurf != null ? GetChildDouble(frontSurf, "housingThickness", 2) : 2,
                        HousingStyle = constOpt != null ? GetChildText(constOpt, "housingStyle", graph.UnitOptions.Materials.HousingStyle) : graph.UnitOptions.Materials.HousingStyle,
                        InsulationType = constOpt != null ? GetChildText(constOpt, "insulationType", graph.UnitOptions.Materials.InsulationType) : graph.UnitOptions.Materials.InsulationType
                    };

                    // Detect internals
                    var internals = new List<string>();
                    var coilEls = FindDescendants(segEl, "coil");
                    if (coilEls.Any() || tag.Equals("segment_CC", StringComparison.OrdinalIgnoreCase) || tag.Equals("segment_HC", StringComparison.OrdinalIgnoreCase))
                    {
                        if (coilEls.Any())
                        {
                            foreach (var coil in coilEls)
                            {
                                string bh = GetChildText(coil, "coilBulkheadMaterial", "");
                                string cType = GetChildText(coil, "coilType", "Coil");
                                internals.Add(string.IsNullOrEmpty(bh) ? cType : $"{cType} ({bh} Bulkhead)");
                            }
                        }
                        else
                        {
                            internals.Add(tag.Equals("segment_CC", StringComparison.OrdinalIgnoreCase) ? "Cooling Coil Wall" : "Heating Coil Wall");
                        }
                    }

                    var fanEls = FindDescendants(segEl, "fan");
                    if (fanEls.Any() || tag.Equals("segment_FS", StringComparison.OrdinalIgnoreCase) || tag.Equals("segment_FE", StringComparison.OrdinalIgnoreCase) || tag.Equals("segment_FR", StringComparison.OrdinalIgnoreCase))
                    {
                        internals.Add("Fan Array / Wall");
                    }
                    if (tag.Equals("segment_HW", StringComparison.OrdinalIgnoreCase)) internals.Add("Heat Recovery Wheel");
                    if (tag.Equals("segment_AT", StringComparison.OrdinalIgnoreCase)) internals.Add("Sound Attenuator Baffles");
                    if (tag.Equals("segment_MB", StringComparison.OrdinalIgnoreCase)) internals.Add("Mixing Dampers");
                    if (tag.Equals("segment_PC", StringComparison.OrdinalIgnoreCase)) internals.Add("Pipe Chase Enclosure");
                    if (tag.Contains("FF", StringComparison.OrdinalIgnoreCase) || tag.Contains("RF", StringComparison.OrdinalIgnoreCase) || tag.Contains("AF", StringComparison.OrdinalIgnoreCase))
                    {
                        internals.Add("Filter Rack / Wall");
                    }

                    string friendlyName = SegmentNames.TryGetValue(typeCode, out var fn) ? fn : $"Segment {typeCode}";

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
                        Dimensions = ParseDimensions(geom),
                        Casing = casing,
                        Internals = internals,
                        HasFrontChannel = GetChildBool(segEl, "hasFrontChannel", false),
                        HasRearChannel = GetChildBool(segEl, "hasRearChannel", false),
                        HasMotorRemovalRail = GetChildBool(segEl, "hasMotorRemovalRail", false)
                    };

                    graph.Segments.Add(segment);
                    segMap[id] = segment;
                    segIdx++;
                }
            }

            // Shipping Skids (inside shippingSkidList)
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
                    AuthoritativeWeight = null, // Strict weight rule: requires confirmation
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

            // Motor Controls (inside motorControlList)
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
