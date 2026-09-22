using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Xml.Linq;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Bridge;

namespace AHUVerification.Core.Services
{
    public class VerificationResult
    {
        public NormalizedXmlGraph Graph { get; set; } = new();
        public Dictionary<string, Fact> Facts { get; set; } = new();
        public List<ChecklistInstance> Checklists { get; set; } = new();
        public int UnconfirmedFactsCount { get; set; }
        public int BlockedChecksCount { get; set; }
        public int IncompleteSpecialQuotesCount { get; set; }
        public int CompletedChecksCount { get; set; }
        public string ActiveRulePackVersion { get; set; } = "";
        public string ActiveRulePackSha256 { get; set; } = "";
        public int ActiveRulePackGeneration { get; set; }
        public bool SourceIsTrusted { get; set; }
        public bool IsReadyForFinal { get; set; }
    }

    public class VerificationHostService
    {
        private readonly OpenXmlTemplatePatcher _patcher = new();
        private readonly FactExtractor _factExtractor = new();
        private readonly AstRuleEvaluator _evaluator = new();

        public VerificationResult VerifySource(
            string configXml,
            string? orderRevXml,
            string? manifestXml,
            RulePackBundle activePack,
            Dictionary<string, Fact>? manualOverrides = null,
            List<SpecialQuote>? sqItems = null,
            List<ChecklistInstance>? existingChecklists = null,
            bool isTrusted = false)
        {
            if (string.IsNullOrWhiteSpace(configXml))
                throw new ArgumentException("A trusted Config.xml source is required.", nameof(configXml));
            if (activePack == null || activePack.Rules == null)
                throw new ArgumentException("A validated active Rule Pack is required.", nameof(activePack));

            var graph = new NormalizedXmlParser().Parse(configXml);
            OrderRevisionData? orderRev = null;
            if (!string.IsNullOrEmpty(orderRevXml))
            {
                orderRev = new OrderRevParser().Parse(orderRevXml);
            }
            if (!string.IsNullOrWhiteSpace(manifestXml))
                XDocument.Parse(manifestXml);

            var facts = _factExtractor.ExtractFacts(graph, orderRev);
            ApplyManualOverrides(facts, manualOverrides, activePack);

            var checklists = _evaluator.GenerateChecklists(activePack.Rules, graph, facts, existingChecklists);
            int unconfirmedFactsCount = facts.Values.Count(f => f.Status == FactStatus.Unknown || f.Confidence == FactConfidence.RequiresConfirmation);
            var rulesById = activePack.Rules.ToDictionary(r => r.Id, StringComparer.Ordinal);
            int completedChecksCount = 0;
            int blockedChecksCount = 0;
            foreach (var check in checklists)
            {
                rulesById.TryGetValue(check.RuleId, out var rule);
                bool completed = check.Applicability == RuleApplicability.NotApplicable
                    || (check.Applicability == RuleApplicability.Applicable && check.Status == CheckStatus.Passed)
                    || (check.Applicability == RuleApplicability.Applicable && check.Status == CheckStatus.NA && rule?.AllowNA == true);
                if (completed) completedChecksCount++;
                else blockedChecksCount++;
            }

            var safeSqItems = sqItems ?? new List<SpecialQuote>();
            int incompleteSqCount = safeSqItems.Count(sq => sq.IsCompleted != true);
            bool isReadyForFinal = unconfirmedFactsCount == 0 && blockedChecksCount == 0 && incompleteSqCount == 0;

            return new VerificationResult
            {
                Graph = graph,
                Facts = facts,
                Checklists = checklists,
                UnconfirmedFactsCount = unconfirmedFactsCount,
                BlockedChecksCount = blockedChecksCount,
                IncompleteSpecialQuotesCount = incompleteSqCount,
                CompletedChecksCount = completedChecksCount,
                ActiveRulePackVersion = activePack.Manifest?.Version ?? "",
                ActiveRulePackSha256 = activePack.Manifest?.BundleSha256 ?? "",
                SourceIsTrusted = isTrusted,
                IsReadyForFinal = isReadyForFinal && isTrusted
            };
        }

        private void ApplyManualOverrides(
            Dictionary<string, Fact> facts,
            Dictionary<string, Fact>? manualOverrides,
            RulePackBundle activePack)
        {
            if (manualOverrides == null) return;

            foreach (var entry in manualOverrides)
            {
                string key = FactContractValidator.CanonicalizeKey(entry.Key, activePack.FactContract);
                if (!facts.ContainsKey(key))
                    throw new ArgumentException($"Manual override references unregistered fact '{entry.Key}'.", nameof(manualOverrides));

                object? value = NormalizeJsonValue(entry.Value?.Value);
                if (value == null)
                    throw new ArgumentException($"Manual override for '{entry.Key}' must provide a value.", nameof(manualOverrides));
                if (activePack.FactContract.ValueKind == JsonValueKind.Object
                    && FactContractValidator.TryGetFactType(activePack.FactContract, key, out _)
                    && !FactContractValidator.IsFactValueCompatible(activePack.FactContract, key, value))
                    throw new ArgumentException($"Manual override for '{entry.Key}' has a value incompatible with the fact contract.", nameof(manualOverrides));

                _factExtractor.OverrideFact(facts, key, value, "Detailer", entry.Value?.PromptNote);
            }
        }

        private static object? NormalizeJsonValue(object? value)
        {
            if (value is not JsonElement element) return value;
            return element.ValueKind switch
            {
                JsonValueKind.String => element.GetString(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Number when element.TryGetInt64(out var integer) => integer,
                JsonValueKind.Number when element.TryGetDouble(out var number) && double.IsFinite(number) => number,
                JsonValueKind.Null => null,
                _ => null
            };
        }

        public void RecomputeAndExport(
            string configXml,
            string? orderRevXml,
            string? manifestXml,
            RulePackBundle activePack,
            string targetXlsxPath,
            Dictionary<string, Fact> rendererFacts,
            List<SpecialQuote> sqItems,
            List<ChecklistInstance> userChecklists,
            string generalComments,
            bool isDraft,
            Dictionary<string, Fact>? manualOverrides = null,
            NormalizedXmlGraph? rendererGraph = null)
        {
            if (string.IsNullOrWhiteSpace(targetXlsxPath) || !Path.IsPathRooted(targetXlsxPath) || !targetXlsxPath.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Target path must be an absolute path ending in .xlsx");
            }

            Dictionary<string, Fact> factsForExport;
            List<ChecklistInstance> checklistsForExport;
            NormalizedXmlGraph graphForExport;
            if (string.IsNullOrWhiteSpace(configXml))
            {
                if (!isDraft)
                    throw new InvalidOperationException("Export requires the trusted raw Config.xml source; renderer-only state cannot be certified.");

                // Manual-unit authoring has no source provenance.  It remains
                // available as an explicitly draft-only workbook using the
                // renderer's current state.  This branch is never reachable
                // for final export and the patcher stamps the draft notice.
                factsForExport = rendererFacts ?? new Dictionary<string, Fact>();
                checklistsForExport = userChecklists ?? new List<ChecklistInstance>();
                graphForExport = rendererGraph ?? new NormalizedXmlGraph();
            }
            else
            {
                // Renderer facts are never used as the source of truth.  Preserve
                // only explicit manual overrides (or the legacy marker on a fact)
                // and derive all other values again from raw source and active pack.
                var effectiveOverrides = manualOverrides ?? rendererFacts
                    .Where(pair => pair.Value?.Status == FactStatus.ManuallyOverridden)
                    .ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.OrdinalIgnoreCase);
                var verifiedModel = VerifySource(configXml, orderRevXml, manifestXml, activePack, effectiveOverrides, sqItems, userChecklists, isTrusted: !isDraft);

                if (!isDraft && !verifiedModel.IsReadyForFinal)
                {
                    throw new InvalidOperationException("Final export requires 100% verification completion and all facts confirmed");
                }

                factsForExport = verifiedModel.Facts;
                checklistsForExport = verifiedModel.Checklists;
                graphForExport = verifiedModel.Graph;
            }

            string? targetDirectory = Path.GetDirectoryName(Path.GetFullPath(targetXlsxPath));
            if (string.IsNullOrWhiteSpace(targetDirectory))
                throw new InvalidOperationException("Target path has no parent directory.");
            Directory.CreateDirectory(targetDirectory);
            string tmpPath = Path.Combine(targetDirectory, $".{Path.GetFileName(targetXlsxPath)}.{Guid.NewGuid():N}.tmp");
            string templatePath = activePack.TemplatePath;
            try
            {
                _patcher.PatchTemplate(
                    templatePath,
                    tmpPath,
                    activePack.TemplateMap,
                    factsForExport,
                    sqItems ?? new List<SpecialQuote>(),
                    checklistsForExport,
                    activePack.Rules,
                    generalComments,
                    isDraft,
                    graphForExport
                );
                OpenXmlTemplatePatcher.ValidateGeneratedWorkbook(tmpPath);
                File.Move(tmpPath, targetXlsxPath, overwrite: true);
            }
            finally
            {
                if (File.Exists(tmpPath)) File.Delete(tmpPath);
            }
        }
    }
}
