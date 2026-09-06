using System.Collections.Generic;

namespace AHUVerification.Core.Manual
{
    public class ManualCasingOptions
    {
        public string? ExteriorMaterial { get; set; }
        public int? ExteriorGauge { get; set; }
        public string? InteriorMaterial { get; set; }
        public int? InteriorGauge { get; set; }
        public double? HousingThickness { get; set; }
        public string? HousingStyle { get; set; }
        public string? InsulationType { get; set; }
    }

    public class ManualSegmentItem
    {
        public string Id { get; set; } = "";
        public string TypeCode { get; set; } = "";
        public string Name { get; set; } = "";
        public string SkidId { get; set; } = "";
        public double Length { get; set; }
        public double? Width { get; set; }
        public double? Height { get; set; }
        public double Weight { get; set; }
        public string AirPressureType { get; set; } = "Negative";
        public double AirVolume { get; set; } = 18000;
        public string? HandOrientation { get; set; }
        public List<string> Internals { get; set; } = new();
        public bool? HasFrontChannel { get; set; }
        public bool? HasRearChannel { get; set; }
        public bool? HasMotorRemovalRail { get; set; }
        public ManualCasingOptions? Casing { get; set; }
    }

    public class ManualSkidItem
    {
        public string Id { get; set; } = "";
        public int Index { get; set; }
        public string Name { get; set; } = "";
        public double? BaseHeight { get; set; }
        public string? BaseMaterial { get; set; }
        public string? BaseType { get; set; }
        public bool? HasSubFloor { get; set; }
        public string? SubFloorMaterial { get; set; }
        public double? AuthoritativeWeight { get; set; }
        public bool? IsWeightConfirmed { get; set; }
    }

    public class ManualCasingMaterials
    {
        public string? ExteriorMaterialType { get; set; }
        public int? ExteriorMaterialGauge { get; set; }
        public string? InteriorMaterialType { get; set; }
        public int? InteriorMaterialGauge { get; set; }
        public string? FloorMaterialType { get; set; }
        public int? FloorMaterialGauge { get; set; }
        public string? InsulationType { get; set; }
        public string? HousingStyle { get; set; }
    }

    public class ManualUnitConfig
    {
        public string JobName { get; set; } = "Custom AHU Project";
        public string ComNumber { get; set; } = "COM-000000";
        public string DetailerName { get; set; } = "Detailer";
        public string UnitType { get; set; } = "Outdoor";
        public string HousingStyle { get; set; } = "ThermalBreak";
        public double? DefaultUnitWidth { get; set; }
        public double? DefaultUnitHeight { get; set; }
        public double? DefaultBaseHeight { get; set; }
        public double? DefaultWallThickness { get; set; }
        public double? TotalStaticPressure { get; set; }
        public ManualCasingMaterials? CasingMaterials { get; set; }
        public List<ManualSkidItem>? Skids { get; set; }
        public List<ManualSegmentItem>? Segments { get; set; }

        // Legacy compatibility fields
        public int? SkidCount { get; set; }
        public double? WallThickness { get; set; }
        public double? BaseHeight { get; set; }
    }

    public class SegmentTemplate
    {
        public string TypeCode { get; set; } = "";
        public string Name { get; set; } = "";
        public string Category { get; set; } = "";
        public double DefaultLength { get; set; }
        public double DefaultWeight { get; set; }
        public string DefaultPressure { get; set; } = "Negative";
        public List<string> DefaultInternals { get; set; } = new();
        public string Description { get; set; } = "";
    }

    public class ManualSynthesisResult
    {
        public Models.NormalizedXmlGraph Graph { get; set; } = new();
        public Dictionary<string, Models.Fact> BaselineFacts { get; set; } = new();
        public Dictionary<string, Models.Fact> Facts { get; set; } = new();
        public Dictionary<string, Models.Fact> ManualOverrides { get; set; } = new();
        public string RawConfigXml { get; set; } = "";
        public string GeneralComments { get; set; } = "";
    }
}
