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
        public bool IsDirty { get; private set; }

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
            Dictionary<string, Fact>? synthesizedFacts = null)
        {
            if (string.IsNullOrWhiteSpace(configXml))
                throw new ArgumentException("Config.xml content cannot be empty", nameof(configXml));
            if (activePack == null)
                throw new ArgumentNullException(nameof(activePack));

            SessionId = Guid.NewGuid().ToString("N");
            Revision = 1;

            FilePath = filePath ?? "";
            FileName = !string.IsNullOrEmpty(filePath) ? Path.GetFileName(filePath) : (isUpz ? "UnitPackage.upz" : (isTrusted ? "Config.xml" : "Manual Unit Configuration.xml"));
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

            // Enforce CE1 authority boundary: legacy hydration (e.g. from saved DVL projects)
            // must never establish trusted verification history on an authentic source session.
            Checklists = (!isTrusted && initialChecklists != null)
                ? initialChecklists.Select(CloneChecklist).ToList()
                : new List<ChecklistInstance>();

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
                    RawConfigXml = RawConfigXml
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

                check.Status = cmd.Status;
                if (cmd.Comment != null)
                {
                    check.DetailerComment = cmd.Comment;
                }
                if (cmd.DetailerInitials != null)
                {
                    check.DetailerInitials = cmd.DetailerInitials;
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

                int existingIndex = SpecialQuotes.FindIndex(sq => sq.Id == incoming.Id);
                if (existingIndex >= 0)
                {
                    SpecialQuotes[existingIndex] = incoming;
                }
                else
                {
                    int slotIndex = SpecialQuotes.FindIndex(sq => sq.Slot == incoming.Slot);
                    if (slotIndex >= 0)
                    {
                        SpecialQuotes[slotIndex] = incoming;
                    }
                    else
                    {
                        SpecialQuotes.Add(incoming);
                    }
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

                var map = cmd.Assignments.ToDictionary(a => a.QuoteId, a => a.Slot, StringComparer.Ordinal);
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

                ReevaluateInternal();
                Revision++;

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

            bool templateRetrievable = !string.IsNullOrEmpty(ActiveRulePack?.TemplatePath) && File.Exists(ActiveRulePack.TemplatePath);
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
    }
}
