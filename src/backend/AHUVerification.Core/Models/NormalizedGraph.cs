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

        [JsonPropertyName("floorMaterialGaugeString")]
        public string FloorMaterialGaugeString { get; set; } = "16";

        [JsonPropertyName("housingStyle")]
        public string HousingStyle { get; set; } = "ThermalBreak";

        [JsonPropertyName("insulationType")]
        public string InsulationType { get; set; } = "Foam";

        [JsonPropertyName("exteriorPaintType")]
        public string ExteriorPaintType { get; set; } = "None";

        [JsonPropertyName("interiorPaintType")]
        public string InteriorPaintType { get; set; } = "None";

        [JsonPropertyName("floorPaintType")]
        public string FloorPaintType { get; set; } = "None";

        [JsonPropertyName("housingThicknessFront")]
        public double HousingThicknessFront { get; set; } = 2.0;

        [JsonPropertyName("housingThicknessRear")]
        public double HousingThicknessRear { get; set; } = 2.0;

        [JsonPropertyName("housingThicknessTop")]
        public double HousingThicknessTop { get; set; } = 2.0;

        [JsonPropertyName("housingThicknessBottom")]
        public double HousingThicknessBottom { get; set; } = 0.0;

        [JsonPropertyName("housingThicknessLeft")]
        public double HousingThicknessLeft { get; set; } = 2.0;

        [JsonPropertyName("housingThicknessRight")]
        public double HousingThicknessRight { get; set; } = 2.0;
    }

    public class UnitOptions
    {
        [JsonPropertyName("unitType")]
        public string UnitType { get; set; } = "Outdoor";

        [JsonPropertyName("brandOption")]
        public string BrandOption { get; set; } = "YORKCustom";

        [JsonPropertyName("unitConstructionType")]
        public string UnitConstructionType { get; set; } = "Standard";

        [JsonPropertyName("shippingProtection")]
        public string ShippingProtection { get; set; } = "ShrinkWrap";

        [JsonPropertyName("washdown")]
        public bool Washdown { get; set; }

        [JsonPropertyName("knockdown")]
        public bool Knockdown { get; set; }

        [JsonPropertyName("hasUTL")]
        public bool HasUTL { get; set; }

        [JsonPropertyName("lipHeight")]
        public double LipHeight { get; set; }

        [JsonPropertyName("isSeismic")]
        public bool IsSeismic { get; set; }

        [JsonPropertyName("noa")]
        public bool Noa { get; set; }

        [JsonPropertyName("thermalBreak")]
        public bool ThermalBreak { get; set; } = true;

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
        public string RoofSlopeHighSide { get; set; } = "Center";

        [JsonPropertyName("roofPeak")]
        public string RoofPeak { get; set; } = "Center";

        [JsonPropertyName("roofPeakZDim")]
        public double RoofPeakZDim { get; set; } = 97;
    }

    public class CurbOptions
    {
        [JsonPropertyName("hasCurbRest")]
        public bool HasCurbRest { get; set; } = true;
    }

    public class TestingOptions
    {
        [JsonPropertyName("deflectionTest")]
        public string DeflectionTest { get; set; } = "None";

        [JsonPropertyName("leakageTest")]
        public string LeakageTest { get; set; } = "None";

        [JsonPropertyName("fanVibrationTest")]
        public string FanVibrationTest { get; set; } = "None";

        [JsonPropertyName("requireCustomerWitness")]
        public bool RequireCustomerWitness { get; set; }
    }

    public class UnitDoor
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("segmentId")]
        public string SegmentId { get; set; } = "";

        [JsonPropertyName("unitSide")]
        public string UnitSide { get; set; } = "Front";

        [JsonPropertyName("width")]
        public double Width { get; set; }

        [JsonPropertyName("height")]
        public double Height { get; set; }

        [JsonPropertyName("swing")]
        public string Swing { get; set; } = "Out";

        [JsonPropertyName("hingeSide")]
        public string HingeSide { get; set; } = "Left";

        [JsonPropertyName("hasWindow")]
        public bool HasWindow { get; set; }

        [JsonPropertyName("hasViewPort")]
        public bool HasViewPort { get; set; }

        [JsonPropertyName("latchType")]
        public string LatchType { get; set; } = "Standard";

        [JsonPropertyName("doorType")]
        public string DoorType { get; set; } = "Standard";
    }

    public class UnitDamper
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("segmentId")]
        public string SegmentId { get; set; } = "";

        [JsonPropertyName("unitSide")]
        public string UnitSide { get; set; } = "Front";

        [JsonPropertyName("width")]
        public double Width { get; set; }

        [JsonPropertyName("height")]
        public double Height { get; set; }

        [JsonPropertyName("depth")]
        public double Depth { get; set; }

        [JsonPropertyName("damperType")]
        public string DamperType { get; set; } = "Standard";

        [JsonPropertyName("actuatorType")]
        public string ActuatorType { get; set; } = "None";

        [JsonPropertyName("bladeType")]
        public string BladeType { get; set; } = "Airfoil";

        [JsonPropertyName("hasAttachedLouver")]
        public bool HasAttachedLouver { get; set; }
    }

    public class UnitFloorDrain
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("segmentId")]
        public string SegmentId { get; set; } = "";

        [JsonPropertyName("unitSide")]
        public string UnitSide { get; set; } = "Bottom";

        [JsonPropertyName("type")]
        public string Type { get; set; } = "Standard";

        [JsonPropertyName("pipingMaterial")]
        public string PipingMaterial { get; set; } = "StainlessSteel";

        [JsonPropertyName("connectionDiameter")]
        public double ConnectionDiameter { get; set; } = 1.25;

        [JsonPropertyName("holeDiameter")]
        public double HoleDiameter { get; set; } = 1.50;

        [JsonPropertyName("connectionSide")]
        public string ConnectionSide { get; set; } = "Left";

        [JsonPropertyName("geometry")]
        public Dimensions Geometry { get; set; } = new();
    }

    public class UnitDuctOpening
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("segmentId")]
        public string SegmentId { get; set; } = "";

        [JsonPropertyName("unitSide")]
        public string UnitSide { get; set; } = "Front";

        [JsonPropertyName("width")]
        public double Width { get; set; }

        [JsonPropertyName("height")]
        public double Height { get; set; }

        [JsonPropertyName("shape")]
        public string Shape { get; set; } = "Rectangle";

        [JsonPropertyName("airType")]
        public string AirType { get; set; } = "Supply";

        [JsonPropertyName("ductType")]
        public string DuctType { get; set; } = "Sleeved";
    }

    public class UnitDrainPanOpening
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("segmentId")]
        public string SegmentId { get; set; } = "";

        [JsonPropertyName("width")]
        public double Width { get; set; }

        [JsonPropertyName("length")]
        public double Length { get; set; }

        [JsonPropertyName("depth")]
        public double Depth { get; set; }
    }

    public class FanConfig
    {
        [JsonPropertyName("isFanArray")]
        public bool IsFanArray { get; set; }

        [JsonPropertyName("arrayQtyHeight")]
        public int ArrayQtyHeight { get; set; } = 1;

        [JsonPropertyName("arrayQtyWidth")]
        public int ArrayQtyWidth { get; set; } = 1;

        [JsonPropertyName("arrayGrid")]
        public string ArrayGrid { get; set; } = "1x1";

        [JsonPropertyName("hasRedundancy")]
        public bool HasRedundancy { get; set; }

        [JsonPropertyName("hasStand")]
        public bool HasStand { get; set; }

        [JsonPropertyName("hasDualFanSeparationWall")]
        public bool HasDualFanSeparationWall { get; set; }

        [JsonPropertyName("hasMotorRemovalRail")]
        public bool HasMotorRemovalRail { get; set; }

        [JsonPropertyName("isolationType")]
        public string IsolationType { get; set; } = "None";

        [JsonPropertyName("fanCount")]
        public int FanCount { get; set; } = 1;

        [JsonPropertyName("motorHp")]
        public double MotorHp { get; set; }

        [JsonPropertyName("voltage")]
        public double Voltage { get; set; } = 460;
    }

    public class CoilConfig
    {
        [JsonPropertyName("bulkheadMaterial")]
        public string BulkheadMaterial { get; set; } = "STL GALV";

        [JsonPropertyName("hasStackingRack")]
        public bool HasStackingRack { get; set; }

        [JsonPropertyName("stackingRackMaterial")]
        public string StackingRackMaterial { get; set; } = "";

        [JsonPropertyName("dripPanMaterial")]
        public string DripPanMaterial { get; set; } = "StainlessSteel_304";

        [JsonPropertyName("staggeredOverlap")]
        public double StaggeredOverlap { get; set; }

        [JsonPropertyName("connectionHand")]
        public string ConnectionHand { get; set; } = "Right";

        [JsonPropertyName("coilCount")]
        public int CoilCount { get; set; } = 1;
    }

    public class FilterConfig
    {
        [JsonPropertyName("filterType")]
        public string FilterType { get; set; } = "FlatFilter";

        [JsonPropertyName("loadMethod")]
        public string LoadMethod { get; set; } = "FrontLoad";

        [JsonPropertyName("bulkheadMaterial")]
        public string BulkheadMaterial { get; set; } = "STL GALV";

        [JsonPropertyName("gaugeType")]
        public string GaugeType { get; set; } = "None";

        [JsonPropertyName("gaugeDoorId")]
        public string GaugeDoorId { get; set; } = "";

        [JsonPropertyName("gaugeMountingType")]
        public string GaugeMountingType { get; set; } = "";
    }

    public class HeatWheelConfig
    {
        [JsonPropertyName("vendor")]
        public string Vendor { get; set; } = "";

        [JsonPropertyName("model")]
        public string Model { get; set; } = "";

        [JsonPropertyName("wheelType")]
        public string WheelType { get; set; } = "Enthalpy";

        [JsonPropertyName("mediaType")]
        public string MediaType { get; set; } = "MolecularSieve";

        [JsonPropertyName("hasPurge")]
        public bool HasPurge { get; set; }

        [JsonPropertyName("allowVariableSpeed")]
        public bool AllowVariableSpeed { get; set; }

        [JsonPropertyName("wheelDiameter")]
        public double WheelDiameter { get; set; }

        [JsonPropertyName("recoveryPercentCFM")]
        public double RecoveryPercentCFM { get; set; }
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

        [JsonPropertyName("subFloorMaterialType")]
        public string SubFloorMaterialType { get; set; } = "STL GALV";

        [JsonPropertyName("subFloorMaterialGauge")]
        public int SubFloorMaterialGauge { get; set; } = 22;

        [JsonPropertyName("subFloorPaintType")]
        public string SubFloorPaintType { get; set; } = "None";

        [JsonPropertyName("floorAttachmentType")]
        public string FloorAttachmentType { get; set; } = "StitchWeld";

        [JsonPropertyName("isUpperBase")]
        public bool IsUpperBase { get; set; }

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

        [JsonPropertyName("floorMaterial")]
        public string FloorMaterial { get; set; } = "STL GALV";

        [JsonPropertyName("floorGauge")]
        public int FloorGauge { get; set; } = 16;

        [JsonPropertyName("floorGaugeString")]
        public string FloorGaugeString { get; set; } = "16";

        [JsonPropertyName("housingThickness")]
        public double HousingThickness { get; set; } = 2;

        [JsonPropertyName("housingThicknessFront")]
        public double HousingThicknessFront { get; set; } = 2;

        [JsonPropertyName("housingThicknessTop")]
        public double HousingThicknessTop { get; set; } = 2;

        [JsonPropertyName("housingStyle")]
        public string HousingStyle { get; set; } = "ThermalBreak";

        [JsonPropertyName("insulationType")]
        public string InsulationType { get; set; } = "Foam";

        [JsonPropertyName("exteriorPaintType")]
        public string ExteriorPaintType { get; set; } = "None";

        [JsonPropertyName("interiorPaintType")]
        public string InteriorPaintType { get; set; } = "None";

        [JsonPropertyName("floorPaintType")]
        public string FloorPaintType { get; set; } = "None";
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

        [JsonPropertyName("isTiered")]
        public bool IsTiered { get; set; }

        [JsonPropertyName("tierLevel")]
        public int TierLevel { get; set; } = 1;

        [JsonPropertyName("elevationY")]
        public double ElevationY { get; set; }

        [JsonPropertyName("doors")]
        public List<UnitDoor> Doors { get; set; } = new();

        [JsonPropertyName("dampers")]
        public List<UnitDamper> Dampers { get; set; } = new();

        [JsonPropertyName("floorDrains")]
        public List<UnitFloorDrain> FloorDrains { get; set; } = new();

        [JsonPropertyName("ductOpenings")]
        public List<UnitDuctOpening> DuctOpenings { get; set; } = new();

        [JsonPropertyName("drainPanOpenings")]
        public List<UnitDrainPanOpening> DrainPanOpenings { get; set; } = new();

        [JsonPropertyName("fanConfig")]
        public FanConfig? FanConfig { get; set; }

        [JsonPropertyName("coilConfig")]
        public CoilConfig? CoilConfig { get; set; }

        [JsonPropertyName("filterConfig")]
        public FilterConfig? FilterConfig { get; set; }

        [JsonPropertyName("heatWheelConfig")]
        public HeatWheelConfig? HeatWheelConfig { get; set; }
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

        [JsonPropertyName("isTiered")]
        public bool IsTiered { get; set; }

        [JsonPropertyName("isStacked")]
        public bool IsStacked { get; set; }

        [JsonPropertyName("isStackedTopUnit")]
        public bool IsStackedTopUnit { get; set; }

        [JsonPropertyName("hasFloorDrains")]
        public bool HasFloorDrains { get; set; }

        [JsonPropertyName("dimensions")]
        public UnitDimensions Dimensions { get; set; } = new();

        [JsonPropertyName("unitOptions")]
        public UnitOptions UnitOptions { get; set; } = new();

        [JsonPropertyName("roofOptions")]
        public RoofOptions RoofOptions { get; set; } = new();

        [JsonPropertyName("curbOptions")]
        public CurbOptions CurbOptions { get; set; } = new();

        [JsonPropertyName("testingOptions")]
        public TestingOptions TestingOptions { get; set; } = new();

        [JsonPropertyName("skids")]
        public List<ShippingSkid> Skids { get; set; } = new();

        [JsonPropertyName("bases")]
        public List<UnitBase> Bases { get; set; } = new();

        [JsonPropertyName("segments")]
        public List<Segment> Segments { get; set; } = new();

        [JsonPropertyName("motorControls")]
        public List<MotorControl> MotorControls { get; set; } = new();

        [JsonPropertyName("doors")]
        public List<UnitDoor> Doors { get; set; } = new();

        [JsonPropertyName("dampers")]
        public List<UnitDamper> Dampers { get; set; } = new();

        [JsonPropertyName("floorDrains")]
        public List<UnitFloorDrain> FloorDrains { get; set; } = new();
    }
}
