using System.Collections.Generic;
using System.Text.Json.Serialization;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Session
{
    public class OpenSourceCommand
    {
        [JsonPropertyName("filePath")]
        public string FilePath { get; set; } = "";

        [JsonPropertyName("configXml")]
        public string? ConfigXml { get; set; }

        [JsonPropertyName("orderRevXml")]
        public string? OrderRevXml { get; set; }

        [JsonPropertyName("manifestXml")]
        public string? ManifestXml { get; set; }

        [JsonPropertyName("isUpz")]
        public bool IsUpz { get; set; }

        [JsonPropertyName("isTrusted")]
        public bool IsTrusted { get; set; } = true;
    }

    public class OverrideFactCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("factId")]
        public string FactId { get; set; } = "";

        [JsonPropertyName("value")]
        public object? Value { get; set; }

        [JsonPropertyName("comment")]
        public string? Comment { get; set; }

        [JsonPropertyName("author")]
        public string? Author { get; set; }
    }

    public class RevertFactCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("factId")]
        public string FactId { get; set; } = "";
    }

    public class UpdateChecklistCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("checkId")]
        public string CheckId { get; set; } = "";

        [JsonPropertyName("status")]
        public CheckStatus Status { get; set; }

        [JsonPropertyName("comment")]
        public string? Comment { get; set; }

        [JsonPropertyName("detailerInitials")]
        public string? DetailerInitials { get; set; }
    }

    public class UpdateSpecialQuoteCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("specialQuote")]
        public SpecialQuote SpecialQuote { get; set; } = new();
    }

    public class DeleteSpecialQuoteCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("quoteId")]
        public string QuoteId { get; set; } = "";
    }

    public class UpdateGeneralCommentsCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("comments")]
        public string Comments { get; set; } = "";
    }

    public class ResetSessionCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }
    }

    public class SessionCommandResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("revision")]
        public long Revision { get; set; }

        [JsonPropertyName("snapshot")]
        public ProjectSessionSnapshot? Snapshot { get; set; }

        [JsonPropertyName("isConflict")]
        public bool IsConflict { get; set; }

        [JsonPropertyName("errorMessage")]
        public string? ErrorMessage { get; set; }

        public static SessionCommandResult Ok(ProjectSessionSnapshot snapshot)
        {
            return new SessionCommandResult
            {
                Success = true,
                Revision = snapshot.Revision,
                Snapshot = snapshot,
                IsConflict = false
            };
        }

        public static SessionCommandResult Conflict(long currentRevision, ProjectSessionSnapshot snapshot, string message)
        {
            return new SessionCommandResult
            {
                Success = false,
                Revision = currentRevision,
                Snapshot = snapshot,
                IsConflict = true,
                ErrorMessage = message
            };
        }

        public static SessionCommandResult Fail(string message, ProjectSessionSnapshot? snapshot = null)
        {
            return new SessionCommandResult
            {
                Success = false,
                Revision = snapshot?.Revision ?? 0,
                Snapshot = snapshot,
                IsConflict = false,
                ErrorMessage = message
            };
        }
    }
}
