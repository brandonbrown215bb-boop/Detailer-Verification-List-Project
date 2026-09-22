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
        public bool IsTrusted { get; set; } = false;

        [JsonPropertyName("sourceHandle")]
        public string? SourceHandle { get; set; }

        [JsonPropertyName("initialOverrides")]
        public Dictionary<string, Fact>? InitialOverrides { get; set; }

        [JsonPropertyName("initialChecklists")]
        public List<ChecklistInstance>? InitialChecklists { get; set; }

        [JsonPropertyName("initialSpecialQuotes")]
        public List<SpecialQuote>? InitialSpecialQuotes { get; set; }

        [JsonPropertyName("initialGeneralComments")]
        public string? InitialGeneralComments { get; set; }
    }

    public class CreateManualProjectCommand
    {
        [JsonPropertyName("config")]
        public Manual.ManualUnitConfig Config { get; set; } = new();
    }

    public class BatchFactOverrideItem
    {
        [JsonPropertyName("factId")]
        public string FactId { get; set; } = "";

        [JsonPropertyName("value")]
        public object? Value { get; set; }

        [JsonPropertyName("comment")]
        public string? Comment { get; set; }

        [JsonPropertyName("author")]
        public string? Author { get; set; }
    }

    public class BatchOverrideFactsCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }

        [JsonPropertyName("overrides")]
        public List<BatchFactOverrideItem> Overrides { get; set; } = new();
    }

    public class OverrideFactCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }

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

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }

        [JsonPropertyName("factId")]
        public string FactId { get; set; } = "";
    }

    public class UpdateChecklistCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }

        [JsonPropertyName("checkId")]
        public string CheckId { get; set; } = "";

        [JsonPropertyName("status")]
        public CheckStatus? Status { get; set; }

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

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }

        [JsonPropertyName("specialQuote")]
        public SpecialQuote SpecialQuote { get; set; } = new();
    }

    public class DeleteSpecialQuoteCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }

        [JsonPropertyName("quoteId")]
        public string QuoteId { get; set; } = "";
    }

    public class SpecialQuoteSlotAssignment
    {
        [JsonPropertyName("quoteId")]
        public string QuoteId { get; set; } = "";

        [JsonPropertyName("slot")]
        public int Slot { get; set; }
    }

    public class ReorderSpecialQuotesCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }

        [JsonPropertyName("assignments")]
        public List<SpecialQuoteSlotAssignment> Assignments { get; set; } = new();
    }

    public class UpdateGeneralCommentsCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }

        [JsonPropertyName("comments")]
        public string Comments { get; set; } = "";

        [JsonPropertyName("generalComments")]
        public string? GeneralCommentsAlias
        {
            get => Comments;
            set
            {
                if (!string.IsNullOrEmpty(value) && string.IsNullOrEmpty(Comments))
                {
                    Comments = value;
                }
            }
        }
    }

    public class ResetSessionCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }
    }

    public class SaveProjectCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("targetPath")]
        public string? TargetPath { get; set; }

        [JsonPropertyName("defaultDirectory")]
        public string? DefaultDirectory { get; set; }

        [JsonPropertyName("forceSaveAs")]
        public bool ForceSaveAs { get; set; }

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }
    }

    public class OpenDvlCommand
    {
        [JsonPropertyName("filePath")]
        public string FilePath { get; set; } = "";
    }

    public class ExportExcelDeliverableCommand
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = "";

        [JsonPropertyName("isDraft")]
        public bool IsDraft { get; set; }

        [JsonPropertyName("targetPath")]
        public string? TargetPath { get; set; }

        [JsonPropertyName("defaultDirectory")]
        public string? DefaultDirectory { get; set; }

        [JsonPropertyName("expectedRevision")]
        public long ExpectedRevision { get; set; }

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }
    }

    public class RecoveryInfo
    {
        [JsonPropertyName("hasRecovery")]
        public bool HasRecovery { get; set; }

        [JsonPropertyName("jobName")]
        public string? JobName { get; set; }

        [JsonPropertyName("comNumber")]
        public string? ComNumber { get; set; }

        [JsonPropertyName("author")]
        public string? Author { get; set; }

        [JsonPropertyName("lastSavedAt")]
        public string? LastSavedAt { get; set; }

        [JsonPropertyName("sourceFileName")]
        public string? SourceFileName { get; set; }

        [JsonPropertyName("isTrusted")]
        public bool IsTrusted { get; set; }

        [JsonPropertyName("recoveryFilePath")]
        public string? RecoveryFilePath { get; set; }
    }

    public class ExportDeliverableResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("filePath")]
        public string FilePath { get; set; } = "";

        [JsonPropertyName("fileName")]
        public string FileName { get; set; } = "";

        [JsonPropertyName("isDraft")]
        public bool IsDraft { get; set; }
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
