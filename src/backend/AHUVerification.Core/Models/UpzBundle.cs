using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace AHUVerification.Core.Models
{
    public class OrderRevisionData
    {
        [JsonPropertyName("productType")]
        public string ProductType { get; set; } = "";
        [JsonPropertyName("jobName")]
        public string JobName { get; set; } = "";
        [JsonPropertyName("orderNumber")]
        public string OrderNumber { get; set; } = "";
        [JsonPropertyName("lineNumber")]
        public int LineNumber { get; set; } = 1;
        [JsonPropertyName("projectName")]
        public string ProjectName { get; set; } = "";
        [JsonPropertyName("projectId")]
        public string ProjectId { get; set; } = "";
        [JsonPropertyName("baseSQOrderNumber")]
        public string BaseSQOrderNumber { get; set; } = "";
        [JsonPropertyName("tagList")]
        public List<string> TagList { get; set; } = new();

        [JsonPropertyName("primaryTag")]
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
