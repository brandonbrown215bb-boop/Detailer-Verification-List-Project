using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AHUVerification.Core.Models
{
    public class RulePackInfo
    {
        [JsonPropertyName("version")]
        public string Version { get; set; } = "";

        [JsonPropertyName("sha256")]
        public string Sha256 { get; set; } = "";
    }

    public class SourceXmlInfo
    {
        [JsonPropertyName("fileName")]
        public string FileName { get; set; } = "Config.xml";

        [JsonPropertyName("fileSha256")]
        public string FileSha256 { get; set; } = "";

        [JsonPropertyName("schemaVersion")]
        public string SchemaVersion { get; set; } = "2018.9.14.1003";

        [JsonPropertyName("rawXml")]
        public string RawXml { get; set; } = "";
    }

    public class DvlProjectFile
    {
        [JsonPropertyName("formatVersion")]
        public string FormatVersion { get; set; } = "1.0";

        [JsonPropertyName("appVersion")]
        public string AppVersion { get; set; } = "1.0.0";

        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");

        [JsonPropertyName("lastSavedAt")]
        public string LastSavedAt { get; set; } = DateTime.UtcNow.ToString("o");

        [JsonPropertyName("author")]
        public string Author { get; set; } = "Detailer";

        [JsonPropertyName("checkerName")]
        public string? CheckerName { get; set; }

        [JsonPropertyName("jobName")]
        public string JobName { get; set; } = "AHU Project";

        [JsonPropertyName("comNumber")]
        public string ComNumber { get; set; } = "COM-000000";

        [JsonPropertyName("rulePack")]
        public RulePackInfo RulePack { get; set; } = new();

        [JsonPropertyName("sourceXml")]
        public SourceXmlInfo SourceXml { get; set; } = new();

        [JsonPropertyName("normalizedGraph")]
        public NormalizedXmlGraph NormalizedGraph { get; set; } = new();

        [JsonPropertyName("factRegistry")]
        public Dictionary<string, Fact> FactRegistry { get; set; } = new();

        [JsonPropertyName("sqItems")]
        public List<SpecialQuote> SqItems { get; set; } = new();

        [JsonPropertyName("checklistInstances")]
        public List<ChecklistInstance> ChecklistInstances { get; set; } = new();

        [JsonPropertyName("generalComments")]
        public string GeneralComments { get; set; } = "";
    }
}
