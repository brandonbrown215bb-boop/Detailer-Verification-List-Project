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

        [JsonPropertyName("overrideHistory")]
        public List<FactOverrideEntry> OverrideHistory { get; set; } = new();
    }
}
