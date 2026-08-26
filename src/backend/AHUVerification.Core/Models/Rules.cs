using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AHUVerification.Core.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum RuleScope
    {
        Unit,
        Skid,
        Segment,
        Component
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum RuleApplicability
    {
        Applicable,
        NotApplicable,
        NeedsInput
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum CheckStatus
    {
        Incomplete,
        Passed,
        NA,
        Flagged
    }

    public class RuleDefinition
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("semanticKey")]
        public string SemanticKey { get; set; } = "";

        [JsonPropertyName("scope")]
        public RuleScope Scope { get; set; } = RuleScope.Unit;

        [JsonPropertyName("category")]
        public string Category { get; set; } = "";

        [JsonPropertyName("subgroup")]
        public string? Subgroup { get; set; }

        [JsonPropertyName("order")]
        public int Order { get; set; }

        [JsonPropertyName("text")]
        public string Text { get; set; } = "";

        [JsonPropertyName("reference")]
        public string? Reference { get; set; }

        [JsonPropertyName("excelRow")]
        public int? ExcelRow { get; set; }

        [JsonPropertyName("requiredFacts")]
        public List<string> RequiredFacts { get; set; } = new();

        [JsonPropertyName("predicate")]
        public Dictionary<string, JsonElement>? Predicate { get; set; }

        [JsonPropertyName("allowNA")]
        public bool AllowNA { get; set; } = true;

        [JsonPropertyName("verificationMode")]
        public string VerificationMode { get; set; } = "ManualCheckbox";

        [JsonPropertyName("isArchived")]
        public bool? IsArchived { get; set; }
    }

    public class FactTrace
    {
        [JsonPropertyName("key")]
        public string Key { get; set; } = "";

        [JsonPropertyName("label")]
        public string Label { get; set; } = "";

        [JsonPropertyName("value")]
        public object? Value { get; set; }

        [JsonPropertyName("status")]
        public FactStatus Status { get; set; }
    }

    public class ChecklistInstance
    {
        [JsonPropertyName("ruleId")]
        public string RuleId { get; set; } = "";

        [JsonPropertyName("semanticKey")]
        public string SemanticKey { get; set; } = "";

        [JsonPropertyName("instanceKey")]
        public string InstanceKey { get; set; } = "";

        [JsonPropertyName("scopeTargetId")]
        public string ScopeTargetId { get; set; } = "";

        [JsonPropertyName("applicability")]
        public RuleApplicability Applicability { get; set; } = RuleApplicability.Applicable;

        [JsonPropertyName("applicabilityReason")]
        public string ApplicabilityReason { get; set; } = "";

        [JsonPropertyName("status")]
        public CheckStatus Status { get; set; } = CheckStatus.Incomplete;

        [JsonPropertyName("detailerComment")]
        public string DetailerComment { get; set; } = "";

        [JsonPropertyName("checkerComment")]
        public string? CheckerComment { get; set; }

        [JsonPropertyName("updatedAt")]
        public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("o");

        [JsonPropertyName("factTraces")]
        public List<FactTrace> FactTraces { get; set; } = new();
    }

    public class SpecialQuote
    {
        [JsonPropertyName("slot")]
        public int Slot { get; set; } // 1..22

        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("text")]
        public string Text { get; set; } = "";

        [JsonPropertyName("linkedSkidId")]
        public string? LinkedSkidId { get; set; }

        [JsonPropertyName("linkedRuleId")]
        public string? LinkedRuleId { get; set; }

        [JsonPropertyName("initials")]
        public string? Initials { get; set; }

        [JsonPropertyName("isCompleted")]
        public bool? IsCompleted { get; set; }
    }

    public class CellCoordinate
    {
        [JsonPropertyName("sheet")]
        public string Sheet { get; set; } = "";

        [JsonPropertyName("cell")]
        public string Cell { get; set; } = "";
    }

    public class RuleCellMapping
    {
        [JsonPropertyName("ruleId")]
        public string RuleId { get; set; } = "";

        [JsonPropertyName("row")]
        public int Row { get; set; }

        [JsonPropertyName("naCell")]
        public string NaCell { get; set; } = "";

        [JsonPropertyName("detailerCell")]
        public string DetailerCell { get; set; } = "";

        [JsonPropertyName("checkerCell")]
        public string CheckerCell { get; set; } = "";

        [JsonPropertyName("commentsCell")]
        public string CommentsCell { get; set; } = "";

        [JsonPropertyName("initialsCell")]
        public string InitialsCell { get; set; } = "";
    }

    public class SqRangeMapping
    {
        [JsonPropertyName("sheet")]
        public string Sheet { get; set; } = "Verification List";

        [JsonPropertyName("startRow")]
        public int StartRow { get; set; } = 4;

        [JsonPropertyName("endRow")]
        public int EndRow { get; set; } = 25;

        [JsonPropertyName("slotCol")]
        public string SlotCol { get; set; } = "G";

        [JsonPropertyName("textCol")]
        public string TextCol { get; set; } = "H";
    }

    public class TemplateMap
    {
        [JsonPropertyName("templateVersion")]
        public string TemplateVersion { get; set; } = "";

        [JsonPropertyName("generalFields")]
        public Dictionary<string, CellCoordinate> GeneralFields { get; set; } = new();

        [JsonPropertyName("sqRange")]
        public SqRangeMapping SqRange { get; set; } = new();

        [JsonPropertyName("ruleCellMappings")]
        public Dictionary<string, RuleCellMapping> RuleCellMappings { get; set; } = new();
    }

    public class RulePackManifestFileEntry
    {
        [JsonPropertyName("sha256")]
        public string Sha256 { get; set; } = "";

        [JsonPropertyName("totalRules")]
        public int? TotalRules { get; set; }

        [JsonPropertyName("activeRules")]
        public int? ActiveRules { get; set; }

        [JsonPropertyName("archivedRules")]
        public int? ArchivedRules { get; set; }
    }

    public class RulePackManifest
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("version")]
        public string Version { get; set; } = "";

        [JsonPropertyName("generatedAt")]
        public string GeneratedAt { get; set; } = "";

        [JsonPropertyName("bundleSha256")]
        public string BundleSha256 { get; set; } = "";

        [JsonPropertyName("files")]
        public Dictionary<string, RulePackManifestFileEntry> Files { get; set; } = new();
    }
}
