using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Session
{
    public class ScopeReadinessSummary
    {
        [JsonPropertyName("scopeTargetId")]
        public string ScopeTargetId { get; set; } = "";

        [JsonPropertyName("totalChecksCount")]
        public int TotalChecksCount { get; set; }

        [JsonPropertyName("applicableChecksCount")]
        public int ApplicableChecksCount { get; set; }

        [JsonPropertyName("completedChecksCount")]
        public int CompletedChecksCount { get; set; }

        [JsonPropertyName("incompleteChecksCount")]
        public int IncompleteChecksCount { get; set; }

        [JsonPropertyName("blockedChecksCount")]
        public int BlockedChecksCount { get; set; }

        [JsonPropertyName("percentComplete")]
        public int PercentComplete { get; set; }

        [JsonPropertyName("isComplete")]
        public bool IsComplete { get; set; }
    }

    public class ProjectReadinessSummary
    {
        [JsonPropertyName("isReadyForFinal")]
        public bool IsReadyForFinal { get; set; }

        [JsonPropertyName("isDraftOnly")]
        public bool IsDraftOnly { get; set; }

        [JsonPropertyName("unconfirmedFactsCount")]
        public int UnconfirmedFactsCount { get; set; }

        [JsonPropertyName("blockedChecksCount")]
        public int BlockedChecksCount { get; set; }

        [JsonPropertyName("incompleteChecksCount")]
        public int IncompleteChecksCount { get; set; }

        [JsonPropertyName("completedChecksCount")]
        public int CompletedChecksCount { get; set; }

        [JsonPropertyName("totalApplicableChecksCount")]
        public int TotalApplicableChecksCount { get; set; }

        [JsonPropertyName("totalChecksCount")]
        public int TotalChecksCount { get; set; }

        [JsonPropertyName("incompleteSpecialQuotesCount")]
        public int IncompleteSpecialQuotesCount { get; set; }

        [JsonPropertyName("percentComplete")]
        public int PercentComplete { get; set; }

        [JsonPropertyName("scopeReadinessMap")]
        public Dictionary<string, ScopeReadinessSummary> ScopeReadinessMap { get; set; } = new();

        [JsonPropertyName("blockers")]
        public List<string> Blockers { get; set; } = new();
    }

    public class SourceMetadataSummary
    {
        [JsonPropertyName("fileName")]
        public string FileName { get; set; } = "";

        [JsonPropertyName("filePath")]
        public string FilePath { get; set; } = "";

        [JsonPropertyName("fileSha256")]
        public string FileSha256 { get; set; } = "";

        [JsonPropertyName("isUpz")]
        public bool IsUpz { get; set; }

        [JsonPropertyName("isTrusted")]
        public bool IsTrusted { get; set; }

        [JsonPropertyName("orderRevision")]
        public OrderRevisionData? OrderRevision { get; set; }
    }

    public class RulePackSummary
    {
        [JsonPropertyName("version")]
        public string Version { get; set; } = "";

        [JsonPropertyName("bundleSha256")]
        public string BundleSha256 { get; set; } = "";

        [JsonPropertyName("generation")]
        public int Generation { get; set; }
    }

    public class ProjectSessionSnapshot
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("revision")]
        public long Revision { get; set; }

        [JsonPropertyName("graph")]
        public NormalizedXmlGraph Graph { get; set; } = new();

        [JsonPropertyName("facts")]
        public Dictionary<string, Fact> Facts { get; set; } = new();

        [JsonPropertyName("checklists")]
        public List<ChecklistInstance> Checklists { get; set; } = new();

        [JsonPropertyName("specialQuotes")]
        public List<SpecialQuote> SpecialQuotes { get; set; } = new();

        [JsonPropertyName("generalComments")]
        public string GeneralComments { get; set; } = "";

        [JsonPropertyName("source")]
        public SourceMetadataSummary Source { get; set; } = new();

        [JsonPropertyName("rulePack")]
        public RulePackSummary RulePack { get; set; } = new();

        [JsonPropertyName("readiness")]
        public ProjectReadinessSummary Readiness { get; set; } = new();

        [JsonPropertyName("isDirty")]
        public bool IsDirty { get; set; }
    }
}
