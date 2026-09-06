using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AHUVerification.Core.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum FactStatus
    {
        Known,
        Derived,
        Unknown,
        ManuallyOverridden
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum FactConfidence
    {
        Authoritative,
        RequiresConfirmation
    }

    public class FactOverrideEntry
    {
        [JsonPropertyName("previousValue")]
        public object? PreviousValue { get; set; }

        [JsonPropertyName("overriddenBy")]
        public string OverriddenBy { get; set; } = "Detailer";

        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; } = DateTime.UtcNow.ToString("o");

        [JsonPropertyName("note")]
        public string? Note { get; set; }
    }

    public class FactSnapshot
    {
        [JsonPropertyName("value")]
        public object? Value { get; set; }

        [JsonPropertyName("status")]
        public FactStatus Status { get; set; }

        [JsonPropertyName("confidence")]
        public FactConfidence Confidence { get; set; }

        [JsonPropertyName("sourceRawValue")]
        public object? SourceRawValue { get; set; }

        [JsonPropertyName("sourcePointer")]
        public string? SourcePointer { get; set; }

        [JsonPropertyName("derivationName")]
        public string? DerivationName { get; set; }

        [JsonPropertyName("promptNote")]
        public string? PromptNote { get; set; }

        [JsonPropertyName("sourceState")]
        public string? SourceState { get; set; }
    }

    public class FactAuditEntry
    {
        [JsonPropertyName("action")]
        public string Action { get; set; } = "";

        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; } = DateTime.UtcNow.ToString("o");

        [JsonPropertyName("by")]
        public string By { get; set; } = "Detailer";

        [JsonPropertyName("note")]
        public string? Note { get; set; }

        [JsonPropertyName("snapshot")]
        public FactSnapshot Snapshot { get; set; } = new();
    }

    public class Fact
    {
        [JsonPropertyName("key")]
        public string Key { get; set; } = "";

        [JsonPropertyName("label")]
        public string Label { get; set; } = "";

        [JsonPropertyName("category")]
        public string Category { get; set; } = "";

        [JsonPropertyName("value")]
        public object? Value { get; set; }

        [JsonPropertyName("status")]
        public FactStatus Status { get; set; } = FactStatus.Unknown;

        [JsonPropertyName("sourcePointer")]
        public string? SourcePointer { get; set; }

        [JsonPropertyName("sourceRawValue")]
        public object? SourceRawValue { get; set; }

        [JsonPropertyName("derivationName")]
        public string? DerivationName { get; set; }

        [JsonPropertyName("confidence")]
        public FactConfidence Confidence { get; set; } = FactConfidence.Authoritative;

        [JsonPropertyName("promptNote")]
        public string? PromptNote { get; set; }

        [JsonPropertyName("sourceState")]
        public string? SourceState { get; set; }

        [JsonPropertyName("calculatedValue")]
        public object? CalculatedValue { get; set; }

        [JsonPropertyName("overrideHistory")]
        public List<FactOverrideEntry> OverrideHistory { get; set; } = new();

        [JsonPropertyName("originalSnapshot")]
        public FactSnapshot? OriginalSnapshot { get; set; }

        [JsonPropertyName("auditHistory")]
        public List<FactAuditEntry> AuditHistory { get; set; } = new();
    }
}
