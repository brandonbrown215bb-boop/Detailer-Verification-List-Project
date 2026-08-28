using System.Collections.Generic;
using AHUVerification.Core.Models;

namespace AHUVerification.Tests
{
    public static class TestGraphFactory
    {
        public static NormalizedXmlGraph CreateStandardMultiSkidGraph()
        {
            return new NormalizedXmlGraph
            {
                UnitWeight = 18500,
                TotalStaticPressure = 3.0,
                Dimensions = new UnitDimensions { Length = 360, Width = 96, Height = 108 },
                UnitOptions = new UnitOptions
                {
                    UnitType = "Outdoor",
                    BrandOption = "YORKCustom",
                    UnitConstructionType = "Standard",
                    DefaultUnitBaseHeight = 12,
                    Materials = new MaterialOptions
                    {
                        ExteriorMaterialType = "STL GALV PPC",
                        ExteriorMaterialGauge = 18,
                        InteriorMaterialType = "STL GALV",
                        InteriorMaterialGauge = 22,
                        FloorMaterialType = "STL GALV",
                        FloorMaterialGauge = 16,
                        HousingStyle = "ThermalBreak",
                        InsulationType = "Foam"
                    }
                },
                RoofOptions = new RoofOptions { HasSlopedRoof = true, RoofSlope = 0.25 },
                CurbOptions = new CurbOptions { HasCurbRest = true },
                Skids = new List<ShippingSkid>
                {
                    new() { Id = "skid-1", Index = 1, Name = "Skid 1 (Mixing & Filtration)", SegmentIds = new() { "seg-1", "seg-2" }, BaseIds = new() { "base-1" }, CalculatedWeight = 4200, Dimensions = new() { Length = 96, Width = 96, Height = 108 } },
                    new() { Id = "skid-2", Index = 2, Name = "Skid 2 (Heat Recovery & Coil)", SegmentIds = new() { "seg-3", "seg-4" }, BaseIds = new() { "base-2" }, CalculatedWeight = 6500, Dimensions = new() { Length = 96, Width = 96, Height = 108 } },
                    new() { Id = "skid-3", Index = 3, Name = "Skid 3 (Access & Heating)", SegmentIds = new() { "seg-5", "seg-6" }, BaseIds = new() { "base-3" }, CalculatedWeight = 3200, Dimensions = new() { Length = 66, Width = 96, Height = 108 } },
                    new() { Id = "skid-4", Index = 4, Name = "Skid 4 (Supply Fan Wall)", SegmentIds = new() { "seg-7" }, BaseIds = new() { "base-4" }, CalculatedWeight = 3800, Dimensions = new() { Length = 72, Width = 96, Height = 108 } },
                    new() { Id = "skid-5", Index = 5, Name = "Skid 5 (Silencer & Discharge)", SegmentIds = new() { "seg-8", "seg-9" }, BaseIds = new() { "base-5" }, CalculatedWeight = 3400, Dimensions = new() { Length = 96, Width = 96, Height = 108 } }
                },
                Segments = new List<Segment>
                {
                    new() { Id = "seg-1", Tag = "segment_MB", TypeCode = "MB", Name = "Mixing Box", Weight = 2400, Internals = new() { "Damper Wall" } },
                    new() { Id = "seg-2", Tag = "segment_AF", TypeCode = "AF", Name = "Angle Filter", Weight = 1800, Internals = new() { "Angle Filter Track" } },
                    new() { Id = "seg-3", Tag = "segment_HW", TypeCode = "HW", Name = "Heat Wheel", Weight = 3700, Internals = new() { "Heat Wheel Rotor" } },
                    new() { Id = "seg-4", Tag = "segment_CC", TypeCode = "CC", Name = "Cooling Coil", Weight = 2800, Internals = new() { "Coil (Cooling)", "Drain Pan" } },
                    new() { Id = "seg-5", Tag = "segment_XA", TypeCode = "XA", Name = "Access Section", Weight = 1000, Internals = new() { "Access Door" } },
                    new() { Id = "seg-6", Tag = "segment_HC", TypeCode = "HC", Name = "Heating Coil", Weight = 2200, Internals = new() { "Coil (Heating)" } },
                    new() { Id = "seg-7", Tag = "segment_FS", TypeCode = "FS", Name = "Supply Fan", Weight = 3800, Internals = new() { "EBM Fan Wall Array" } },
                    new() { Id = "seg-8", Tag = "segment_AT", TypeCode = "AT", Name = "Sound Attenuator", Weight = 2000, Internals = new() { "Acoustic Silencer" } },
                    new() { Id = "seg-9", Tag = "segment_DP", TypeCode = "DP", Name = "Discharge Plenum", Weight = 1400, Internals = new() }
                }
            };
        }
    }
}

