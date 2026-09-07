using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using AHUVerification.Core.Utils;

namespace AHUVerification.Core.Models
{
    public class RulePackInfo
    {
        [JsonPropertyName("version")]
        public string Version { get; set; } = "";

        [JsonPropertyName("sha256")]
        public string Sha256 { get; set; } = "";

        [JsonPropertyName("ruleSemanticFingerprint")]
        public string? RuleSemanticFingerprint { get; set; }

        [JsonPropertyName("templateSha256")]
        public string? TemplateSha256 { get; set; }

        [JsonPropertyName("templateMapSha256")]
        public string? TemplateMapSha256 { get; set; }

        [JsonPropertyName("approvedMappingsSha256")]
        public string? ApprovedMappingsSha256 { get; set; }

        [JsonPropertyName("templateRetrievable")]
        public bool? TemplateRetrievable { get; set; }
    }

    public class SourceXmlInfo
    {
        [JsonPropertyName("fileName")]
        public string FileName { get; set; } = "Config.xml";

        [JsonPropertyName("fileSha256")]
        public string FileSha256 { get; set; } = "";

        [JsonPropertyName("schemaVersion")]
        public string SchemaVersion { get; set; } = ApplicationVersion.DocumentSchema;

        [JsonPropertyName("rawXml")]
        public string RawXml { get; set; } = "";

        [JsonPropertyName("isUpzBundle")]
        public bool? IsUpzBundle { get; set; }

        [JsonPropertyName("orderRevision")]
        public OrderRevisionData? OrderRevision { get; set; }

        [JsonPropertyName("rawOrderRevisionXml")]
        public string? RawOrderRevisionXml { get; set; }

        [JsonPropertyName("rawManifestXml")]
        public string? RawManifestXml { get; set; }

        [JsonPropertyName("isTrusted")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public bool? IsTrusted { get; set; }
    }

    public class DvlIntegrityInfo
    {
        [JsonPropertyName("algorithm")]
        public string Algorithm { get; set; } = "dvl-canonical-json-v1";

        [JsonPropertyName("sourceXmlSha256")]
        public string? SourceXmlSha256 { get; set; }

        [JsonPropertyName("completeStateSha256")]
        public string? CompleteStateSha256 { get; set; }

        [JsonPropertyName("state")]
        public string State { get; set; } = "complete";
    }

    public class DvlIntegrityValidationResult
    {
        public bool IsVerified { get; set; }
        public bool CertificationAllowed { get; set; }
        public string State { get; set; } = "legacy";
        public string? Message { get; set; }
    }

    public class DvlRulePackSnapshot
    {
        [JsonPropertyName("version")]
        public string Version { get; set; } = "";

        [JsonPropertyName("bundleSha256")]
        public string BundleSha256 { get; set; } = "";

        [JsonPropertyName("rules")]
        public List<RuleDefinition> Rules { get; set; } = new();

        [JsonPropertyName("templateMap")]
        public TemplateMap TemplateMap { get; set; } = new();

        [JsonPropertyName("approvedMappings")]
        public JsonElement ApprovedMappings { get; set; }

        [JsonPropertyName("factContract")]
        public JsonElement FactContract { get; set; }

        [JsonPropertyName("templateSha256")]
        public string? TemplateSha256 { get; set; }

        [JsonPropertyName("templateRetrievable")]
        public bool TemplateRetrievable { get; set; }

        [JsonPropertyName("templateEmbedded")]
        public bool TemplateEmbedded { get; set; }

        [JsonPropertyName("templateBytesBase64")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? TemplateBytesBase64 { get; set; }

        [JsonPropertyName("reproducibility")]
        public string Reproducibility { get; set; } = "snapshot-without-template";
    }

    public class DvlProjectFile
    {
        [JsonPropertyName("formatVersion")]
        public string FormatVersion { get; set; } = ApplicationVersion.DvlFormat;

        [JsonPropertyName("appVersion")]
        public string AppVersion { get; set; } = ApplicationVersion.Current;

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

        [JsonPropertyName("rulePackSnapshot")]
        public DvlRulePackSnapshot? RulePackSnapshot { get; set; }

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

        [JsonPropertyName("integrity")]
        public DvlIntegrityInfo? Integrity { get; set; }
    }
}
