using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;

namespace AHUVerification.Core.Session
{
    public class ProjectSession
    {
        private readonly object _syncLock = new();
        private readonly FactExtractor _factExtractor = new();
        private readonly AstRuleEvaluator _evaluator = new();
        private readonly Dictionary<string, SessionCommandResult> _recentRequestResults = new();
        private readonly Queue<string> _recentRequestOrder = new();
        private const int MaxTrackedRequests = 100;

        private bool TryGetDeduplicatedResult(string? requestId, out SessionCommandResult? result)
        {
            result = null;
            if (string.IsNullOrWhiteSpace(requestId)) return false;
            if (_recentRequestResults.TryGetValue(requestId, out result))
            {
                if (result.Snapshot != null && result.Snapshot.Revision < Revision)
                {
                    result = null;
                    return false;
                }
                return true;
            }
            return false;
        }

        private void InvalidateDeduplicationCache()
        {
            _recentRequestResults.Clear();
            _recentRequestOrder.Clear();
        }

        private SessionCommandResult RecordCommandResult(string? requestId, SessionCommandResult result)
        {
            if (!string.IsNullOrWhiteSpace(requestId))
            {
                if (!_recentRequestResults.ContainsKey(requestId))
                {
                    if (_recentRequestOrder.Count >= MaxTrackedRequests)
                    {
                        var oldest = _recentRequestOrder.Dequeue();
                        _recentRequestResults.Remove(oldest);
                    }
                    _recentRequestOrder.Enqueue(requestId);
                }
                _recentRequestResults[requestId] = result;
            }
            return result;
        }

        public string SessionId { get; }
        public long Revision { get; private set; }

        public string FilePath { get; }
        public string FileName { get; }
        public string FileSha256 { get; }
        public bool IsUpz { get; }
        public bool IsTrusted { get; }

        public string RawConfigXml { get; }
        public string? RawOrderRevXml { get; }
        public string? RawManifestXml { get; }
        public OrderRevisionData? OrderRevision { get; }

        public NormalizedXmlGraph Graph { get; private set; }
        public Dictionary<string, Fact> BaselineFacts { get; private set; }
        public Dictionary<string, Fact> Facts { get; private set; }
        public Dictionary<string, Fact> ManualOverrides { get; private set; }
        public List<ChecklistInstance> Checklists { get; private set; }
        public List<SpecialQuote> SpecialQuotes { get; private set; }
        public string GeneralComments { get; private set; }
        public RulePackBundle ActiveRulePack { get; private set; }
        public int RulePackGeneration { get; private set; }
        public bool IsDirty { get; internal set; }
        public string? CurrentSavePath { get; set; }
        public long LastSavedRevision { get; set; }
        public string? LastSavedAt { get; set; }
        public string? IntegrityState { get; set; }
        public string? IntegrityWarning { get; set; }
        public string? EmbeddedTemplateBytesBase64 { get; set; }

        public ProjectSession(
            string filePath,
            string configXml,
            string? orderRevXml,
            string? manifestXml,
            bool isUpz,
            bool isTrusted,
            RulePackBundle activePack,
            int packGeneration,
            Dictionary<string, Fact>? initialOverrides = null,
            List<ChecklistInstance>? initialChecklists = null,
            List<SpecialQuote>? initialSpecialQuotes = null,
            string? initialGeneralComments = null,
            NormalizedXmlGraph? synthesizedGraph = null,
            Dictionary<string, Fact>? synthesizedBaselineFacts = null,
            Dictionary<string, Fact>? synthesizedFacts = null,
            bool isDvlHydration = false,
            string? sourceFileName = null)
        {
            if (string.IsNullOrWhiteSpace(configXml))
                throw new ArgumentException("Config.xml content cannot be empty", nameof(configXml));
            if (activePack == null)
                throw new ArgumentNullException(nameof(activePack));

            SessionId = Guid.NewGuid().ToString("N");
            Revision = 1;

            FilePath = isDvlHydration ? "" : (filePath ?? "");
            FileName = !string.IsNullOrWhiteSpace(sourceFileName)
                ? sourceFileName
                : (!string.IsNullOrEmpty(filePath) ? Path.GetFileName(filePath) : (isUpz ? "UnitPackage.upz" : (isTrusted ? "Config.xml" : "Manual Unit Configuration.xml")));
            FileSha256 = ComputeSha256(configXml);
            IsUpz = isUpz;
            IsTrusted = isTrusted;

            RawConfigXml = configXml;
            RawOrderRevXml = orderRevXml;
            RawManifestXml = manifestXml;

            ActiveRulePack = activePack;
            RulePackGeneration = packGeneration;

            if (synthesizedGraph != null)
            {
                Graph = synthesizedGraph;
                BaselineFacts = synthesizedBaselineFacts != null ? CloneFacts(synthesizedBaselineFacts) : _factExtractor.ExtractFacts(Graph, OrderRevision);
                Facts = synthesizedFacts != null ? CloneFacts(synthesizedFacts) : CloneFacts(BaselineFacts);
                ManualOverrides = new Dictionary<string, Fact>(StringComparer.Ordinal);

                if (initialOverrides != null)
                {
                    foreach (var kvp in initialOverrides)
                    {
                        ManualOverrides[kvp.Key] = CloneFact(kvp.Value);
                    }
                }
            }
            else
            {
                // Parse graph
                Graph = new NormalizedXmlParser().Parse(configXml);

                // Parse order revision if present
                if (!string.IsNullOrEmpty(orderRevXml))
                {
                    OrderRevision = new OrderRevParser().Parse(orderRevXml);
                }

                // Extract initial baseline facts
                BaselineFacts = _factExtractor.ExtractFacts(Graph, OrderRevision);

                // Clone baseline facts for active dictionary
                Facts = CloneFacts(BaselineFacts);
                ManualOverrides = new Dictionary<string, Fact>(StringComparer.Ordinal);

                if (initialOverrides != null)
                {
                    foreach (var kvp in initialOverrides)
                    {
                        string key = FactContractValidator.CanonicalizeKey(kvp.Key, ActiveRulePack.FactContract);
                        if (Facts.ContainsKey(key))
                        {
                            var lastAudit = kvp.Value.AuditHistory?.LastOrDefault();
                            string author = lastAudit?.By ?? "Detailer";
                            string reason = lastAudit?.Note ?? "Restored override";
                            _factExtractor.OverrideFact(Facts, key, kvp.Value.Value, author, reason);
                            ManualOverrides[key] = Facts[key];
                        }
                    }
                }
            }

            if (isDvlHydration || (!isTrusted && initialChecklists != null))
            {
                Checklists = initialChecklists != null
                    ? initialChecklists.Select(CloneChecklist).ToList()
                    : new List<ChecklistInstance>();
            }
            else
            {
                Checklists = new List<ChecklistInstance>();
            }

            SpecialQuotes = initialSpecialQuotes != null
                ? initialSpecialQuotes.Select(CloneSpecialQuote).ToList()
                : new List<SpecialQuote>();

            GeneralComments = initialGeneralComments ?? "";
            IsDirty = !isTrusted || initialOverrides != null || initialSpecialQuotes != null || !string.IsNullOrEmpty(initialGeneralComments);

            // Generate initial checklists
            ReevaluateInternal();
        }

        public static ProjectSession CreateManual(
            Manual.ManualUnitConfig config,
            RulePackBundle activePack,
            int packGeneration)
        {
            var synthesis = new Manual.ManualUnitFactory().Synthesize(config);
            return new ProjectSession(
                filePath: "",
                configXml: synthesis.RawConfigXml,
                orderRevXml: null,
                manifestXml: null,
                isUpz: false,
                isTrusted: false,
                activePack: activePack,
                packGeneration: packGeneration,
                initialOverrides: synthesis.ManualOverrides,
                initialChecklists: null,
                initialSpecialQuotes: null,
                initialGeneralComments: synthesis.GeneralComments,
                synthesizedGraph: synthesis.Graph,
                synthesizedBaselineFacts: synthesis.BaselineFacts,
                synthesizedFacts: synthesis.Facts
            );
        }

        public ProjectSessionSnapshot CreateSnapshot()
        {
            lock (_syncLock)
            {
                var readiness = ComputeReadinessInternal();

                return new ProjectSessionSnapshot
                {
                    SessionId = SessionId,
                    Revision = Revision,
                    Graph = Graph,
                    Facts = CloneFacts(Facts),
                    Checklists = Checklists.Select(CloneChecklist).ToList(),
                    SpecialQuotes = SpecialQuotes.Select(CloneSpecialQuote).ToList(),
                    GeneralComments = GeneralComments,
                    Source = new SourceMetadataSummary
                    {
                        FileName = FileName,
                        FilePath = FilePath,
                        FileSha256 = FileSha256,
                        IsUpz = IsUpz,
                        IsTrusted = IsTrusted,
                        OrderRevision = OrderRevision,
                        RawOrderRevisionXml = RawOrderRevXml,
                        RawManifestXml = RawManifestXml
                    },
                    RulePack = new RulePackSummary
                    {
                        Version = ActiveRulePack.Manifest?.Version ?? "",
                        BundleSha256 = ActiveRulePack.Manifest?.BundleSha256 ?? "",
                        Generation = RulePackGeneration
                    },
                    Readiness = readiness,
                    IsDirty = IsDirty,
                    RawConfigXml = RawConfigXml,
                    CurrentProjectPath = CurrentSavePath,
                    LastSavedAt = LastSavedAt,
                    IntegrityState = IntegrityState,
                    IntegrityWarning = IntegrityWarning
                };
            }
        }

        public SessionCommandResult OverrideFact(OverrideFactCommand cmd)
        {
            lock (_syncLock)
            {
                if (TryGetDeduplicatedResult(cmd.RequestId, out var deduplicated))
                {
                    return deduplicated!;
                }

                if (cmd.ExpectedRevision != Revision)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Conflict(Revision, CreateSnapshot(),
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}"));
                }

                string key = FactContractValidator.CanonicalizeKey(cmd.FactId, ActiveRulePack.FactContract);
                if (!Facts.ContainsKey(key))
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Fact '{cmd.FactId}' does not exist in registry", CreateSnapshot()));
                }

                object? val = NormalizeValue(cmd.Value);
                if (val == null)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Override for '{cmd.FactId}' must provide a non-null value", CreateSnapshot()));
                }

                if (ActiveRulePack.FactContract.ValueKind == JsonValueKind.Object
                    && !FactContractValidator.IsFactValueCompatible(ActiveRulePack.FactContract, key, val))
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Value for '{cmd.FactId}' is incompatible with fact contract", CreateSnapshot()));
                }

                string author = !string.IsNullOrWhiteSpace(cmd.Author) ? cmd.Author : "Detailer";
                _factExtractor.OverrideFact(Facts, key, val, author, cmd.Comment);

                ManualOverrides[key] = Facts[key];
                IsDirty = true;
                Revision++;
                ReevaluateInternal();

                return RecordCommandResult(cmd.RequestId, SessionCommandResult.Ok(CreateSnapshot()));
            }
        }

        public SessionCommandResult BatchOverrideFacts(BatchOverrideFactsCommand cmd)
        {
            lock (_syncLock)
            {
                if (TryGetDeduplicatedResult(cmd.RequestId, out var deduplicated))
                {
                    return deduplicated!;
                }

                if (cmd.ExpectedRevision != Revision)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Conflict(Revision, CreateSnapshot(),
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}"));
                }

                if (cmd.Overrides == null || cmd.Overrides.Count == 0)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail("Batch overrides list cannot be empty", CreateSnapshot()));
                }

                // Validate all overrides first
                var normalizedEntries = new List<(string key, object val, string author, string? comment)>();
                foreach (var entry in cmd.Overrides)
                {
                    string key = FactContractValidator.CanonicalizeKey(entry.FactId, ActiveRulePack.FactContract);
                    if (!Facts.ContainsKey(key))
                    {
                        return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Fact '{entry.FactId}' does not exist in registry", CreateSnapshot()));
                    }

                    object? val = NormalizeValue(entry.Value);
                    if (val == null)
                    {
                        return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Override for '{entry.FactId}' must provide a non-null value", CreateSnapshot()));
                    }

                    if (ActiveRulePack.FactContract.ValueKind == JsonValueKind.Object
                        && !FactContractValidator.IsFactValueCompatible(ActiveRulePack.FactContract, key, val))
                    {
                        return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Value for '{entry.FactId}' is incompatible with fact contract", CreateSnapshot()));
                    }

                    string author = !string.IsNullOrWhiteSpace(entry.Author) ? entry.Author : "Detailer";
                    normalizedEntries.Add((key, val, author, entry.Comment));
                }

                // Apply all overrides
                foreach (var (key, val, author, comment) in normalizedEntries)
                {
                    _factExtractor.OverrideFact(Facts, key, val, author, comment);
                    ManualOverrides[key] = Facts[key];
                }

                IsDirty = true;
                Revision++;
                ReevaluateInternal();

                return RecordCommandResult(cmd.RequestId, SessionCommandResult.Ok(CreateSnapshot()));
            }
        }

        public SessionCommandResult RevertFact(RevertFactCommand cmd)
        {
            lock (_syncLock)
            {
                if (TryGetDeduplicatedResult(cmd.RequestId, out var deduplicated))
                {
                    return deduplicated!;
                }

                if (cmd.ExpectedRevision != Revision)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Conflict(Revision, CreateSnapshot(),
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}"));
                }

                string key = FactContractValidator.CanonicalizeKey(cmd.FactId, ActiveRulePack.FactContract);
                if (!Facts.ContainsKey(key))
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Fact '{cmd.FactId}' does not exist in registry", CreateSnapshot()));
                }

                _factExtractor.RevertFact(Facts, key);
                ManualOverrides.Remove(key);

                IsDirty = true;
                Revision++;
                ReevaluateInternal();

                return RecordCommandResult(cmd.RequestId, SessionCommandResult.Ok(CreateSnapshot()));
            }
        }

        public SessionCommandResult UpdateChecklist(UpdateChecklistCommand cmd)
        {
            lock (_syncLock)
            {
                if (TryGetDeduplicatedResult(cmd.RequestId, out var deduplicated))
                {
                    return deduplicated!;
                }

                if (cmd.ExpectedRevision != Revision)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Conflict(Revision, CreateSnapshot(),
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}"));
                }

                var check = Checklists.FirstOrDefault(c =>
                    string.Equals(c.InstanceKey, cmd.CheckId, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(c.RuleId, cmd.CheckId, StringComparison.OrdinalIgnoreCase));

                if (check == null)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Checklist item '{cmd.CheckId}' not found", CreateSnapshot()));
                }

                if (cmd.Status.HasValue)
                {
                    if (!Enum.IsDefined(typeof(CheckStatus), cmd.Status.Value))
                    {
                        return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Invalid checklist status: {cmd.Status.Value}", CreateSnapshot()));
                    }

                    var rule = ActiveRulePack?.Rules?.FirstOrDefault(r => string.Equals(r.Id, check.RuleId, StringComparison.OrdinalIgnoreCase));
                    if (cmd.Status.Value == CheckStatus.NA && rule?.AllowNA != true)
                    {
                        return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Checklist item '{cmd.CheckId}' does not allow N/A status", CreateSnapshot()));
                    }

                    check.Status = cmd.Status.Value;
                    if (check.Status == CheckStatus.Incomplete)
                    {
                        check.DetailerInitials = null;
                    }
                }

                if (cmd.Comment != null)
                {
                    check.DetailerComment = cmd.Comment;
                }
                if (cmd.DetailerInitials != null)
                {
                    check.DetailerInitials = cmd.DetailerInitials;
                }
                else if (check.Status == CheckStatus.Passed || check.Status == CheckStatus.Flagged)
                {
                    if (string.IsNullOrWhiteSpace(check.DetailerInitials))
                    {
                        string fallbackInitials = Facts.TryGetValue("unit.detailerInitials", out var fi) && !string.IsNullOrWhiteSpace(fi.Value?.ToString())
                            ? fi.Value.ToString()!.Trim()
                            : (Facts.TryGetValue("unit.detailer", out var df) && !string.IsNullOrWhiteSpace(df.Value?.ToString())
                                ? OpenXmlTemplatePatcher.DeriveInitials(df.Value.ToString()!)
                                : "TD");
                        check.DetailerInitials = fallbackInitials;
                    }
                }
                check.UpdatedAt = DateTime.UtcNow.ToString("o");

                IsDirty = true;
                Revision++;

                return RecordCommandResult(cmd.RequestId, SessionCommandResult.Ok(CreateSnapshot()));
            }
        }

        public SessionCommandResult UpdateSpecialQuote(UpdateSpecialQuoteCommand cmd)
        {
            lock (_syncLock)
            {
                if (TryGetDeduplicatedResult(cmd.RequestId, out var deduplicated))
                {
                    return deduplicated!;
                }

                if (cmd.ExpectedRevision != Revision)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Conflict(Revision, CreateSnapshot(),
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}"));
                }

                var incoming = cmd.SpecialQuote;
                if (incoming == null)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail("SpecialQuote cannot be null", CreateSnapshot()));
                }

                if (string.IsNullOrWhiteSpace(incoming.Id))
                {
                    incoming.Id = Guid.NewGuid().ToString("N");
                }

                if (incoming.Slot < 1 || incoming.Slot > 22)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail(
                        $"Special Quote slot {incoming.Slot} is invalid. The DVL deliverable supports slots 1 through 22.", CreateSnapshot()));
                }

                int existingIndex = SpecialQuotes.FindIndex(sq => sq.Id == incoming.Id);
                int slotIndex = SpecialQuotes.FindIndex(sq => sq.Slot == incoming.Slot);
                if (existingIndex < 0 && slotIndex < 0 && SpecialQuotes.Count >= 22)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail(
                        "Cannot add Special Quote: maximum 22 slots supported by the DVL deliverable.", CreateSnapshot()));
                }

                if (existingIndex >= 0)
                {
                    SpecialQuotes[existingIndex] = incoming;
                }
                else if (slotIndex >= 0)
                {
                    SpecialQuotes[slotIndex] = incoming;
                }
                else
                {
                    SpecialQuotes.Add(incoming);
                }

                IsDirty = true;
                Revision++;

                return RecordCommandResult(cmd.RequestId, SessionCommandResult.Ok(CreateSnapshot()));
            }
        }

        public SessionCommandResult DeleteSpecialQuote(DeleteSpecialQuoteCommand cmd)
        {
            lock (_syncLock)
            {
                if (TryGetDeduplicatedResult(cmd.RequestId, out var deduplicated))
                {
                    return deduplicated!;
                }

                if (cmd.ExpectedRevision != Revision)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Conflict(Revision, CreateSnapshot(),
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}"));
                }

                int removed = SpecialQuotes.RemoveAll(sq => sq.Id == cmd.QuoteId || sq.Slot.ToString() == cmd.QuoteId);
                if (removed == 0)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail($"Special quote '{cmd.QuoteId}' not found", CreateSnapshot()));
                }

                IsDirty = true;
                Revision++;

                return RecordCommandResult(cmd.RequestId, SessionCommandResult.Ok(CreateSnapshot()));
            }
        }

        public SessionCommandResult ReorderSpecialQuotes(ReorderSpecialQuotesCommand cmd)
        {
            lock (_syncLock)
            {
                if (TryGetDeduplicatedResult(cmd.RequestId, out var deduplicated))
                {
                    return deduplicated!;
                }

                if (cmd.ExpectedRevision != Revision)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Conflict(Revision, CreateSnapshot(),
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}"));
                }

                if (cmd.Assignments == null || cmd.Assignments.Count == 0)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail("Reorder assignments cannot be empty", CreateSnapshot()));
                }

                foreach (var assignment in cmd.Assignments)
                {
                    if (assignment.Slot < 1 || assignment.Slot > 22)
                    {
                        return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail(
                            $"Invalid slot {assignment.Slot} in reorder assignment. Must be between 1 and 22.", CreateSnapshot()));
                    }
                }

                if (cmd.Assignments.Select(a => a.Slot).Distinct().Count() != cmd.Assignments.Count)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail(
                        "Reorder assignments contain duplicate slot numbers.", CreateSnapshot()));
                }

                var map = cmd.Assignments.ToDictionary(a => a.QuoteId, a => a.Slot, StringComparer.Ordinal);
                var candidateSlots = SpecialQuotes.Select(sq => map.TryGetValue(sq.Id, out int newSlot) ? newSlot : sq.Slot).ToList();
                if (candidateSlots.Distinct().Count() != candidateSlots.Count)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail(
                        "Reorder assignments produce duplicate slot numbers across special quotes.", CreateSnapshot()));
                }

                foreach (var sq in SpecialQuotes)
                {
                    if (map.TryGetValue(sq.Id, out int newSlot))
                    {
                        sq.Slot = newSlot;
                    }
                }

                SpecialQuotes.Sort((a, b) => a.Slot.CompareTo(b.Slot));

                IsDirty = true;
                Revision++;

                return RecordCommandResult(cmd.RequestId, SessionCommandResult.Ok(CreateSnapshot()));
            }
        }

        public SessionCommandResult UpdateGeneralComments(UpdateGeneralCommentsCommand cmd)
        {
            lock (_syncLock)
            {
                if (TryGetDeduplicatedResult(cmd.RequestId, out var deduplicated))
                {
                    return deduplicated!;
                }

                if (cmd.ExpectedRevision != Revision)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Conflict(Revision, CreateSnapshot(),
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}"));
                }

                GeneralComments = cmd.Comments ?? "";
                IsDirty = true;
                Revision++;

                return RecordCommandResult(cmd.RequestId, SessionCommandResult.Ok(CreateSnapshot()));
            }
        }

        public SessionCommandResult ResetToBaseline(ResetSessionCommand cmd)
        {
            lock (_syncLock)
            {
                if (TryGetDeduplicatedResult(cmd.RequestId, out var deduplicated))
                {
                    return deduplicated!;
                }

                if (cmd.ExpectedRevision != Revision)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Conflict(Revision, CreateSnapshot(),
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}"));
                }

                InvalidateDeduplicationCache();

                Facts = CloneFacts(BaselineFacts);
                ManualOverrides.Clear();
                Checklists = new List<ChecklistInstance>();
                SpecialQuotes.Clear();
                GeneralComments = "";
                IsDirty = false;

                ReevaluateInternal();
                Revision++;

                return RecordCommandResult(cmd.RequestId, SessionCommandResult.Ok(CreateSnapshot()));
            }
        }

        public SessionCommandResult UpdateRulePack(RulePackBundle newPack, int packGeneration)
        {
            if (newPack == null) throw new ArgumentNullException(nameof(newPack));

            lock (_syncLock)
            {
                InvalidateDeduplicationCache();

                ActiveRulePack = newPack;
                RulePackGeneration = packGeneration;
                EmbeddedTemplateBytesBase64 = null;

                ReevaluateInternal();
                IsDirty = true;
                Revision++;
                IntegrityState = "complete";
                IntegrityWarning = null;

                return SessionCommandResult.Ok(CreateSnapshot());
            }
        }

        private void ReevaluateInternal()
        {
            if (ActiveRulePack?.Rules != null)
            {
                Checklists = _evaluator.GenerateChecklists(ActiveRulePack.Rules, Graph, Facts, Checklists);
            }
        }

        private ProjectReadinessSummary ComputeReadinessInternal()
        {
            int unconfirmedFactsCount = Facts.Values.Count(f =>
                f.Status == FactStatus.Unknown || f.Confidence == FactConfidence.RequiresConfirmation);

            var rulesById = ActiveRulePack?.Rules?.ToDictionary(r => r.Id, StringComparer.Ordinal)
                ?? new Dictionary<string, RuleDefinition>();

            int completedChecksCount = 0;
            int blockedChecksCount = 0;
            int incompleteChecksCount = 0;
            int totalApplicableChecksCount = 0;

            foreach (var check in Checklists)
            {
                if (check.Applicability == RuleApplicability.NeedsInput || check.Status == CheckStatus.NeedsInput)
                {
                    blockedChecksCount++;
                }

                if (check.Applicability == RuleApplicability.Applicable)
                {
                    totalApplicableChecksCount++;
                    rulesById.TryGetValue(check.RuleId, out var rule);
                    bool isNaAllowed = rule?.AllowNA == true;

                    if (check.Status == CheckStatus.Passed || (check.Status == CheckStatus.NA && isNaAllowed))
                    {
                        completedChecksCount++;
                    }
                    else
                    {
                        incompleteChecksCount++;
                    }
                }
            }

            int totalChecksCount = Checklists.Count;
            int incompleteSqCount = SpecialQuotes.Count(sq => sq.IsCompleted != true);

            int percentComplete = totalApplicableChecksCount > 0
                ? (int)Math.Round((double)completedChecksCount / totalApplicableChecksCount * 100)
                : 0;

            bool isReadyForFinal = totalApplicableChecksCount > 0
                && unconfirmedFactsCount == 0
                && blockedChecksCount == 0
                && incompleteChecksCount == 0
                && incompleteSqCount == 0
                && IsTrusted;

            var blockers = new List<string>();
            if (!IsTrusted)
            {
                blockers.Add("Project source is not an authentic native UPZ/Config.xml");
            }
            if (unconfirmedFactsCount > 0)
            {
                blockers.Add($"{unconfirmedFactsCount} project facts require confirmation");
            }
            if (blockedChecksCount > 0)
            {
                blockers.Add($"{blockedChecksCount} verification checks are blocked (Needs Input)");
            }
            if (incompleteChecksCount > 0)
            {
                blockers.Add($"{incompleteChecksCount} applicable verification checks are pending completion");
            }
            if (incompleteSqCount > 0)
            {
                blockers.Add($"{incompleteSqCount} special quote items are incomplete");
            }

            bool templateRetrievable = (!string.IsNullOrEmpty(ActiveRulePack?.TemplatePath) && File.Exists(ActiveRulePack.TemplatePath))
                || !string.IsNullOrEmpty(EmbeddedTemplateBytesBase64);
            bool exportBlocked = !templateRetrievable;

            if (!templateRetrievable)
            {
                blockers.Add("Excel template artifact (template.xlsx) is missing or unavailable");
            }

            // Build per-scope readiness map
            var scopeMap = new Dictionary<string, ScopeReadinessSummary>(StringComparer.OrdinalIgnoreCase);
            var scopeIds = Checklists.Select(c => c.ScopeTargetId).Distinct(StringComparer.OrdinalIgnoreCase);

            foreach (string scopeId in scopeIds)
            {
                if (string.IsNullOrEmpty(scopeId)) continue;
                var scopeChecks = Checklists.Where(c => string.Equals(c.ScopeTargetId, scopeId, StringComparison.OrdinalIgnoreCase)).ToList();
                var scopeApplicable = scopeChecks.Where(c => c.Applicability == RuleApplicability.Applicable).ToList();
                int scopeBlocked = scopeChecks.Count(c => c.Applicability == RuleApplicability.NeedsInput || c.Status == CheckStatus.NeedsInput);
                int scopeCompleted = 0;
                int scopeIncomplete = 0;

                foreach (var sc in scopeApplicable)
                {
                    rulesById.TryGetValue(sc.RuleId, out var rule);
                    if (sc.Status == CheckStatus.Passed || (sc.Status == CheckStatus.NA && rule?.AllowNA == true))
                    {
                        scopeCompleted++;
                    }
                    else
                    {
                        scopeIncomplete++;
                    }
                }

                int scopePercent = scopeApplicable.Count > 0
                    ? (int)Math.Round((double)scopeCompleted / scopeApplicable.Count * 100)
                    : 0;

                scopeMap[scopeId] = new ScopeReadinessSummary
                {
                    ScopeTargetId = scopeId,
                    TotalChecksCount = scopeChecks.Count,
                    ApplicableChecksCount = scopeApplicable.Count,
                    CompletedChecksCount = scopeCompleted,
                    IncompleteChecksCount = scopeIncomplete,
                    BlockedChecksCount = scopeBlocked,
                    PercentComplete = scopePercent,
                    IsComplete = scopeApplicable.Count > 0 && scopeBlocked == 0 && scopeIncomplete == 0
                };
            }

            return new ProjectReadinessSummary
            {
                IsReadyForFinal = isReadyForFinal,
                IsDraftOnly = !isReadyForFinal,
                UnconfirmedFactsCount = unconfirmedFactsCount,
                BlockedChecksCount = blockedChecksCount,
                IncompleteChecksCount = incompleteChecksCount,
                CompletedChecksCount = completedChecksCount,
                TotalApplicableChecksCount = totalApplicableChecksCount,
                TotalChecksCount = totalChecksCount,
                IncompleteSpecialQuotesCount = incompleteSqCount,
                PercentComplete = percentComplete,
                ScopeReadinessMap = scopeMap,
                Blockers = blockers,
                ExportBlocked = exportBlocked,
                TemplateRetrievable = templateRetrievable
            };
        }

        private static string ComputeSha256(string content)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(content);
            byte[] hash = SHA256.HashData(bytes);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        private static Dictionary<string, Fact> CloneFacts(Dictionary<string, Fact> source)
        {
            var dict = new Dictionary<string, Fact>(StringComparer.Ordinal);
            foreach (var kvp in source)
            {
                dict[kvp.Key] = CloneFact(kvp.Value);
            }
            return dict;
        }

        private static Fact CloneFact(Fact f)
        {
            return new Fact
            {
                Key = f.Key,
                Label = f.Label,
                Category = f.Category,
                Value = f.Value,
                Status = f.Status,
                Confidence = f.Confidence,
                SourceRawValue = f.SourceRawValue,
                SourcePointer = f.SourcePointer,
                DerivationName = f.DerivationName,
                PromptNote = f.PromptNote,
                SourceState = f.SourceState,
                AuditHistory = f.AuditHistory != null ? new List<FactAuditEntry>(f.AuditHistory) : new List<FactAuditEntry>(),
                OriginalSnapshot = f.OriginalSnapshot != null ? new FactSnapshot
                {
                    Value = f.OriginalSnapshot.Value,
                    Status = f.OriginalSnapshot.Status,
                    Confidence = f.OriginalSnapshot.Confidence,
                    SourceRawValue = f.OriginalSnapshot.SourceRawValue,
                    SourcePointer = f.OriginalSnapshot.SourcePointer,
                    DerivationName = f.OriginalSnapshot.DerivationName,
                    PromptNote = f.OriginalSnapshot.PromptNote,
                    SourceState = f.OriginalSnapshot.SourceState
                } : null
            };
        }

        private static ChecklistInstance CloneChecklist(ChecklistInstance c)
        {
            return new ChecklistInstance
            {
                RuleId = c.RuleId,
                SemanticKey = c.SemanticKey,
                InstanceKey = c.InstanceKey,
                ScopeTargetId = c.ScopeTargetId,
                Applicability = c.Applicability,
                ApplicabilityReason = c.ApplicabilityReason,
                Status = c.Status,
                DetailerComment = c.DetailerComment,
                DetailerInitials = c.DetailerInitials,
                CheckerComment = c.CheckerComment,
                CheckerInitials = c.CheckerInitials,
                UpdatedAt = c.UpdatedAt,
                SemanticFingerprint = c.SemanticFingerprint,
                FactTraces = c.FactTraces != null ? new List<FactTrace>(c.FactTraces) : new List<FactTrace>()
            };
        }

        private static SpecialQuote CloneSpecialQuote(SpecialQuote sq)
        {
            return new SpecialQuote
            {
                Slot = sq.Slot,
                Id = sq.Id,
                Text = sq.Text,
                LinkedSkidId = sq.LinkedSkidId,
                LinkedRuleId = sq.LinkedRuleId,
                Initials = sq.Initials,
                IsCompleted = sq.IsCompleted
            };
        }

        private static object? NormalizeValue(object? val)
        {
            if (val is JsonElement el)
            {
                return el.ValueKind switch
                {
                    JsonValueKind.String => el.GetString(),
                    JsonValueKind.Number => el.TryGetInt64(out long l) ? (object)l : el.GetDouble(),
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Null => null,
                    _ => el.GetRawText()
                };
            }
            return val;
        }

        public DvlProjectFile BuildDvlProject(DvlProjectManager manager)
        {
            lock (_syncLock)
            {
                return manager.CreateProject(
                    graph: Graph,
                    facts: CloneFacts(Facts),
                    sqItems: SpecialQuotes.Select(CloneSpecialQuote).ToList(),
                    checklists: Checklists.Select(CloneChecklist).ToList(),
                    rawXml: RawConfigXml,
                    bundle: ActiveRulePack,
                    generalComments: GeneralComments,
                    sourceFileName: FileName,
                    isUpzBundle: IsUpz,
                    orderRevision: OrderRevision,
                    rawOrderRevisionXml: RawOrderRevXml,
                    rawManifestXml: RawManifestXml,
                    isTrusted: IsTrusted);
            }
        }

        public SessionCommandResult Save(SaveProjectCommand cmd, string resolvedPath, DvlProjectManager manager)
        {
            lock (_syncLock)
            {
                if (TryGetDeduplicatedResult(cmd.RequestId, out var deduplicated))
                {
                    return deduplicated!;
                }

                if (cmd.ExpectedRevision != Revision)
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Conflict(Revision, CreateSnapshot(),
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}"));
                }

                if (string.IsNullOrWhiteSpace(resolvedPath))
                {
                    return RecordCommandResult(cmd.RequestId, SessionCommandResult.Fail("Target save path cannot be empty", CreateSnapshot()));
                }

                var project = BuildDvlProject(manager);
                manager.SaveToFile(project, resolvedPath);

                CurrentSavePath = resolvedPath;
                LastSavedRevision = Revision;
                LastSavedAt = project.LastSavedAt;
                IsDirty = false;

                return RecordCommandResult(cmd.RequestId, SessionCommandResult.Ok(CreateSnapshot()));
            }
        }

        public static ProjectSession OpenDvl(
            DvlProjectFile project,
            string? filePath,
            DvlIntegrityValidationResult integrity,
            RulePackBundle activePack,
            int packGeneration,
            string? templateBase64 = null)
        {
            if (project == null) throw new ArgumentNullException(nameof(project));
            if (activePack == null) throw new ArgumentNullException(nameof(activePack));

            // Restore trust ONLY when the saved project was explicitly authentic (IsTrusted == true)
            // and the saved project integrity is fully verified. Legacy/unknown/untrusted projects remain untrusted.
            bool wasTrusted = project.SourceXml?.IsTrusted == true;

            bool isTrusted = integrity.IsVerified && wasTrusted;

            string configXml = project.SourceXml?.RawXml ?? "";
            if (string.IsNullOrWhiteSpace(configXml))
            {
                throw new ArgumentException("DVL project contains no raw Config.xml content.");
            }

            NormalizedXmlGraph graph = project.NormalizedGraph ?? new NormalizedXmlParser().Parse(configXml);

            string sourceFileName = project.SourceXml?.FileName ?? "";
            if (string.IsNullOrWhiteSpace(sourceFileName))
            {
                sourceFileName = project.SourceXml?.IsUpzBundle == true ? "UnitPackage.upz" : "Config.xml";
            }

            var session = new ProjectSession(
                filePath: null,
                configXml: configXml,
                orderRevXml: project.SourceXml?.RawOrderRevisionXml,
                manifestXml: project.SourceXml?.RawManifestXml,
                isUpz: project.SourceXml?.IsUpzBundle == true,
                isTrusted: isTrusted,
                activePack: activePack,
                packGeneration: packGeneration,
                initialOverrides: ExtractOverridesFromProject(project),
                initialChecklists: project.ChecklistInstances,
                initialSpecialQuotes: project.SqItems,
                initialGeneralComments: project.GeneralComments,
                synthesizedGraph: graph,
                synthesizedBaselineFacts: null,
                synthesizedFacts: project.FactRegistry != null ? CloneFacts(project.FactRegistry) : null,
                isDvlHydration: true,
                sourceFileName: sourceFileName
            );

            session.CurrentSavePath = filePath;
            session.LastSavedRevision = session.Revision;
            session.LastSavedAt = project.LastSavedAt;
            session.IsDirty = false;
            session.IntegrityState = integrity.State;
            session.IntegrityWarning = !integrity.IsVerified ? integrity.Message : (integrity.State == "pack-mismatch" ? integrity.Message : null);
            session.EmbeddedTemplateBytesBase64 = !string.IsNullOrEmpty(templateBase64)
                ? templateBase64
                : project.RulePackSnapshot?.TemplateBytesBase64;

            return session;
        }

        private static Dictionary<string, Fact>? ExtractOverridesFromProject(DvlProjectFile project)
        {
            if (project.FactRegistry == null) return null;
            var overrides = new Dictionary<string, Fact>(StringComparer.Ordinal);
            foreach (var kvp in project.FactRegistry)
            {
                if (kvp.Value?.Status == FactStatus.ManuallyOverridden)
                {
                    overrides[kvp.Key] = kvp.Value;
                }
            }
            return overrides.Count > 0 ? overrides : null;
        }

        public ExportDeliverableResult ExportExcel(
            ExportExcelDeliverableCommand cmd,
            OpenXmlTemplatePatcher patcher,
            string targetPath)
        {
            lock (_syncLock)
            {
                if (cmd.ExpectedRevision != Revision)
                {
                    throw new InvalidOperationException(
                        $"Revision mismatch: command expected revision {cmd.ExpectedRevision}, current is {Revision}");
                }

                if (string.IsNullOrWhiteSpace(targetPath) || !Path.IsPathRooted(targetPath) || !targetPath.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("Target path must be an absolute path ending in .xlsx");
                }

                var readiness = ComputeReadinessInternal();
                if (!cmd.IsDraft)
                {
                    if (!IsTrusted)
                    {
                        throw new InvalidOperationException("Final export requires a verified authentic source (UPZ or verified Config.xml).");
                    }
                    if (!readiness.IsReadyForFinal)
                    {
                        string reasons = string.Join("; ", readiness.Blockers);
                        throw new InvalidOperationException($"Final export blocked: {reasons}");
                    }
                    if (readiness.ExportBlocked)
                    {
                        throw new InvalidOperationException("Final export blocked: Excel template artifact (template.xlsx) is missing or unavailable.");
                    }
                }

                // Ensure 'unit.date' is populated with today's date if missing or not set
                var exportFacts = CloneFacts(Facts);
                if (!exportFacts.TryGetValue("unit.date", out var dateFact) || dateFact.Value == null || string.IsNullOrWhiteSpace(dateFact.Value.ToString()))
                {
                    exportFacts["unit.date"] = new Fact
                    {
                        Key = "unit.date",
                        Label = "Verification Date",
                        Category = "Order & Identity",
                        Value = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                        Status = FactStatus.Known,
                        Confidence = FactConfidence.Authoritative
                    };
                }

                string? tempTemplatePath = null;
                string effectiveTemplatePath;
                if (!string.IsNullOrEmpty(EmbeddedTemplateBytesBase64))
                {
                    byte[] bytes = Convert.FromBase64String(EmbeddedTemplateBytesBase64);
                    tempTemplatePath = Path.Combine(Path.GetTempPath(), $"ahu_tpl_{Guid.NewGuid():N}.xlsx");
                    File.WriteAllBytes(tempTemplatePath, bytes);
                    effectiveTemplatePath = tempTemplatePath;
                }
                else if (!string.IsNullOrEmpty(ActiveRulePack?.TemplatePath) && File.Exists(ActiveRulePack.TemplatePath))
                {
                    effectiveTemplatePath = ActiveRulePack.TemplatePath;
                }
                else
                {
                    throw new InvalidOperationException("Template artifact (template.xlsx) is missing and cannot be retrieved.");
                }

                string? targetDirectory = Path.GetDirectoryName(Path.GetFullPath(targetPath));
                if (string.IsNullOrWhiteSpace(targetDirectory))
                    throw new InvalidOperationException("Target path has no parent directory.");
                Directory.CreateDirectory(targetDirectory);
                string tmpPath = Path.Combine(targetDirectory, $".{Path.GetFileName(targetPath)}.{Guid.NewGuid():N}.tmp");

                if (ActiveRulePack?.TemplateMap == null || ActiveRulePack.Rules == null)
                {
                    throw new InvalidOperationException("Active rule pack template map or rules are missing.");
                }

                try
                {
                    patcher.PatchTemplate(
                        effectiveTemplatePath,
                        tmpPath,
                        ActiveRulePack.TemplateMap,
                        exportFacts,
                        SpecialQuotes.Select(CloneSpecialQuote).ToList(),
                        Checklists.Select(CloneChecklist).ToList(),
                        ActiveRulePack.Rules,
                        GeneralComments,
                        cmd.IsDraft,
                        Graph
                    );
                    OpenXmlTemplatePatcher.ValidateGeneratedWorkbook(tmpPath);
                    File.Move(tmpPath, targetPath, overwrite: true);

                    return new ExportDeliverableResult
                    {
                        Success = true,
                        FilePath = targetPath,
                        FileName = Path.GetFileName(targetPath),
                        IsDraft = cmd.IsDraft
                    };
                }
                finally
                {
                    if (File.Exists(tmpPath)) File.Delete(tmpPath);
                    if (tempTemplatePath != null && File.Exists(tempTemplatePath)) File.Delete(tempTemplatePath);
                }
            }
        }
    }
}
