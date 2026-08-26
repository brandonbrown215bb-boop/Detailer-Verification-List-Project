using System;
using System.Collections.Generic;
using System.Linq;

namespace AHUVerification.Core.Models
{
    public class OrderRevisionData
    {
        public string ProductType { get; set; } = "";
        public string JobName { get; set; } = "";
        public string OrderNumber { get; set; } = "";
        public int LineNumber { get; set; } = 1;
        public string ProjectName { get; set; } = "";
        public string ProjectId { get; set; } = "";
        public string BaseSQOrderNumber { get; set; } = "";
        public List<string> TagList { get; set; } = new();

        public string PrimaryTag => TagList.FirstOrDefault(t => !string.IsNullOrWhiteSpace(t)) ?? "";
    }

    public class ManifestData
    {
        public string SchemaVersion { get; set; } = "";
        public string GeneratingSoftwareName { get; set; } = "";
        public string GeneratingSoftwareVersion { get; set; } = "";
        public List<string> FileEntries { get; set; } = new();
    }

    public class UpzBundle
    {
        public string RawConfigXml { get; set; } = "";
        public string RawOrderRevXml { get; set; } = "";
        public string RawManifestXml { get; set; } = "";

        public OrderRevisionData? OrderRevision { get; set; }
        public ManifestData? Manifest { get; set; }
    }
}
