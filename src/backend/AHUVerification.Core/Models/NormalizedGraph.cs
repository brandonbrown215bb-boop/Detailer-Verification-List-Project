using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AHUVerification.Core.Models
{
    public class Dimensions
    {
        [JsonPropertyName("x")]
        public double X { get; set; }

        [JsonPropertyName("y")]
        public double Y { get; set; }

        [JsonPropertyName("z")]
        public double Z { get; set; }

        [JsonPropertyName("xLength")]
        public double XLength { get; set; }

        [JsonPropertyName("yLength")]
        public double YLength { get; set; }

        [JsonPropertyName("zLength")]
        public double ZLength { get; set; }
    }

    public class MaterialOptions
    {
        [JsonPropertyName("exteriorMaterialType")]
        public string ExteriorMaterialType { get; set; } = "STL GALV PPC";

        [JsonPropertyName("exteriorMaterialGauge")]
        public int ExteriorMaterialGauge { get; set; } = 18;

        [JsonPropertyName("interiorMaterialType")]
        public string InteriorMaterialType { get; set; } = "STL GALV";

        [JsonPropertyName("interiorMaterialGauge")]
        public int InteriorMaterialGauge { get; set; } = 22;

        [JsonPropertyName("floorMaterialType")]
        public string FloorMaterialType { get; set; } = "STL GALV";

        [JsonPropertyName("floorMaterialGauge")]
        public int FloorMaterialGauge { get; set; } = 16;

        [JsonPropertyName("housingStyle")]
        public string HousingStyle { get; set; } = "ThermalBreak";

        [JsonPropertyName("insulationType")]
        public string InsulationType { get; set; } = "Foam";
    }

    public class UnitOptions
    {
        [JsonPropertyName("unitType")]
        public string UnitType { get; set; } = "Outdoor";

        [JsonPropertyName("brandOption")]
        public string BrandOption { get; set; } = "YORKCustom";

        [JsonPropertyName("unitConstructionType")]
        public string UnitConstructionType { get; set; } = "Standard";

        [JsonPropertyName("washdown")]
        public bool Washdown { get; set; }

        [JsonPropertyName("knockdown")]
        public bool Knockdown { get; set; }

        [JsonPropertyName("hasUTL")]
        public bool HasUTL { get; set; }

        [JsonPropertyName("isSeismic")]
        public bool? IsSeismic { get; set; }

        [JsonPropertyName("noaRating")]
        public string? NoaRating { get; set; }

        [JsonPropertyName("primaryAccessSide")]
        public string PrimaryAccessSide { get; set; } = "Left";

        [JsonPropertyName("defaultUnitBaseHeight")]
        public double DefaultUnitBaseHeight { get; set; } = 10;

        [JsonPropertyName("materials")]
        public MaterialOptions Materials { get; set; } = new();
    }

    public class RoofOptions
    {
        [JsonPropertyName("hasSlopedRoof")]
        public bool HasSlopedRoof { get; set; } = true;

        [JsonPropertyName("roofSlope")]
        public double RoofSlope { get; set; } = 0.25;

        [JsonPropertyName("roofSlopeHighSide")]
        public string RoofSlopeHighSide { get; set; } = "Internal";

        [JsonPropertyName("roofPeakZDim")]
        public double RoofPeakZDim { get; set; } = 97;
    }

    public class CurbOptions
    {
        [JsonPropertyName("hasCurbRest")]
        public bool HasCurbRest { get; set; } = true;

        [JsonPropertyName("hasCurb")]
        public bool HasCurb { get; set; }

        [JsonPropertyName("curbHeight")]
        public double CurbHeight { get; set; }
    }

    public class UnitBase
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("materialType")]
        public string MaterialType { get; set; } = "StructuralSteel";

        [JsonPropertyName("baseType")]
        public string BaseType { get; set; } = "A36";

        [JsonPropertyName("paintType")]
        public string PaintType { get; set; } = "ChampagneBase";

        [JsonPropertyName("height")]
        public double Height { get; set; } = 10;

        [JsonPropertyName("lipHeight")]
        public double LipHeight { get; set; }

        [JsonPropertyName("insulationType")]
        public string InsulationType { get; set; } = "Foam_2Inch";

        [JsonPropertyName("housingStyle")]
        public string HousingStyle { get; set; } = "ThermalBreak";

        [JsonPropertyName("hasSubFloor")]
        public bool HasSubFloor { get; set; } = true;

        [JsonPropertyName("subFloorMaterial")]
        public string SubFloorMaterial { get; set; } = "STL GALV 22ga";

        [JsonPropertyName("dimensions")]
        public Dimensions Dimensions { get; set; } = new();
    }

    public class CasingDetail
    {
        [JsonPropertyName("exteriorMaterial")]
        public string ExteriorMaterial { get; set; } = "STL GALV PPC";

        [JsonPropertyName("exteriorGauge")]
        public int ExteriorGauge { get; set; } = 18;

        [JsonPropertyName("interiorMaterial")]
        public string InteriorMaterial { get; set; } = "STL GALV";

        [JsonPropertyName("interiorGauge")]
        public int InteriorGauge { get; set; } = 22;

        [JsonPropertyName("housingThickness")]
        public double HousingThickness { get; set; } = 2;

        [JsonPropertyName("housingStyle")]
        public string HousingStyle { get; set; } = "ThermalBreak";

        [JsonPropertyName("insulationType")]
        public string InsulationType { get; set; } = "Foam";
    }

    public class Segment
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("tag")]
        public string Tag { get; set; } = "";

        [JsonPropertyName("typeCode")]
        public string TypeCode { get; set; } = "";

        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("weight")]
        public double Weight { get; set; }

        [JsonPropertyName("airPressureType")]
        public string AirPressureType { get; set; } = "Negative";

        [JsonPropertyName("airVolume")]
        public double AirVolume { get; set; }

        [JsonPropertyName("handOrientation")]
        public string HandOrientation { get; set; } = "FrontToRear";

        [JsonPropertyName("dimensions")]
        public Dimensions Dimensions { get; set; } = new();

        [JsonPropertyName("casing")]
        public CasingDetail Casing { get; set; } = new();

        [JsonPropertyName("internals")]
        public List<string> Internals { get; set; } = new();

        [JsonPropertyName("hasFrontChannel")]
        public bool HasFrontChannel { get; set; }

        [JsonPropertyName("hasRearChannel")]
        public bool HasRearChannel { get; set; }

        [JsonPropertyName("hasMotorRemovalRail")]
        public bool HasMotorRemovalRail { get; set; }
    }

    public class SkidDimensions
    {
        [JsonPropertyName("length")]
        public double Length { get; set; }

        [JsonPropertyName("width")]
        public double Width { get; set; }

        [JsonPropertyName("height")]
        public double Height { get; set; }
    }

    public class ShippingSkid
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("index")]
        public int Index { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("segmentIds")]
        public List<string> SegmentIds { get; set; } = new();

        [JsonPropertyName("baseIds")]
        public List<string> BaseIds { get; set; } = new();

        [JsonPropertyName("calculatedWeight")]
        public double CalculatedWeight { get; set; }

        [JsonPropertyName("authoritativeWeight")]
        public double? AuthoritativeWeight { get; set; }

        [JsonPropertyName("isWeightConfirmed")]
        public bool IsWeightConfirmed { get; set; }

        [JsonPropertyName("dimensions")]
        public SkidDimensions Dimensions { get; set; } = new();
    }

    public class MotorControl
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("unitSide")]
        public string UnitSide { get; set; } = "Left";

        [JsonPropertyName("motorControlType")]
        public string MotorControlType { get; set; } = "ExternalWireDisconnect";

        [JsonPropertyName("fla")]
        public double Fla { get; set; }

        [JsonPropertyName("voltage")]
        public double Voltage { get; set; } = 460;

        [JsonPropertyName("hp")]
        public double Hp { get; set; }

        [JsonPropertyName("disconnectSize")]
        public double DisconnectSize { get; set; } = 30;

        [JsonPropertyName("weight")]
        public double Weight { get; set; } = 10;

        [JsonPropertyName("serviceSegmentId")]
        public string? ServiceSegmentId { get; set; }
    }

    public class UnitDimensions
    {
        [JsonPropertyName("length")]
        public double Length { get; set; }

        [JsonPropertyName("width")]
        public double Width { get; set; }

        [JsonPropertyName("height")]
        public double Height { get; set; }
    }

    public class NormalizedXmlGraph
    {
        [JsonPropertyName("unitMOMID")]
        public string UnitMOMID { get; set; } = "{00000000-0000-0000-0000-000000000000}";

        [JsonPropertyName("documentVersion")]
        public string DocumentVersion { get; set; } = "2018.9.14.1003";

        [JsonPropertyName("generatingSoftware")]
        public string GeneratingSoftware { get; set; } = "M.O.M. AHU Revision Serializer";

        [JsonPropertyName("unitWeight")]
        public double UnitWeight { get; set; }

        [JsonPropertyName("totalStaticPressure")]
        public double TotalStaticPressure { get; set; }

        [JsonPropertyName("dimensions")]
        public UnitDimensions Dimensions { get; set; } = new();

        [JsonPropertyName("unitOptions")]
        public UnitOptions UnitOptions { get; set; } = new();

        [JsonPropertyName("roofOptions")]
        public RoofOptions RoofOptions { get; set; } = new();

        [JsonPropertyName("curbOptions")]
        public CurbOptions CurbOptions { get; set; } = new();

        [JsonPropertyName("skids")]
        public List<ShippingSkid> Skids { get; set; } = new();

        [JsonPropertyName("bases")]
        public List<UnitBase> Bases { get; set; } = new();

        [JsonPropertyName("segments")]
        public List<Segment> Segments { get; set; } = new();

        [JsonPropertyName("motorControls")]
        public List<MotorControl> MotorControls { get; set; } = new();
    }
}
