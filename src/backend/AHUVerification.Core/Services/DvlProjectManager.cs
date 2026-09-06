using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Globalization;
using AHUVerification.Core.Models;
using AHUVerification.Core.Utils;

namespace AHUVerification.Core.Services
{
    public class DvlProjectManager
    {
        private static readonly JsonSerializerOptions JsonOptions = JsonDefaults.CreateFlexibleOptions();

        public DvlProjectFile CreateProject(
            NormalizedXmlGraph graph,
            Dictionary<string, Fact> facts,
            List<SpecialQuote> sqItems,
            List<ChecklistInstance> checklists,
            string rawXml,
            RulePackBundle bundle,
            string generalComments = "",
            string sourceFileName = "Config.xml",
            bool? isUpzBundle = null,
            OrderRevisionData? orderRevision = null,
            string? rawOrderRevisionXml = null,
            string? rawManifestXml = null)
        {
            if (bundle == null) throw new ArgumentNullException(nameof(bundle));
            bundle.Manifest.Files.TryGetValue("template.xlsx", out var templateEntry);
            bundle.Manifest.Files.TryGetValue("template_map.json", out var mapEntry);
            bundle.Manifest.Files.TryGetValue("approved_mappings.json", out var mappingsEntry);

            var provenance = new RulePackInfo
            {
                Version = bundle.Manifest.Version,
                Sha256 = bundle.Manifest.BundleSha256,
                TemplateSha256 = templateEntry?.Sha256,
                TemplateMapSha256 = mapEntry?.Sha256,
                ApprovedMappingsSha256 = mappingsEntry?.Sha256,
                TemplateRetrievable = File.Exists(bundle.TemplatePath)
            };

            var snapshot = RulePackManager.CreateSnapshot(bundle);

            return CreateProject(
                graph,
                facts,
                sqItems,
                checklists,
                rawXml,
                bundle.Manifest.Version,
                bundle.Manifest.BundleSha256,
                generalComments,
                sourceFileName,
                isUpzBundle,
                orderRevision,
                rawOrderRevisionXml,
                rawManifestXml,
                provenance,
                snapshot);
        }

        public DvlProjectFile CreateProject(
            NormalizedXmlGraph graph,
            Dictionary<string, Fact> facts,
            List<SpecialQuote> sqItems,
            List<ChecklistInstance> checklists,
            string rawXml,
            string rulePackVersion,
            string rulePackSha,
            string generalComments = "",
            string sourceFileName = "Config.xml",
            bool? isUpzBundle = null,
            OrderRevisionData? orderRevision = null,
            string? rawOrderRevisionXml = null,
            string? rawManifestXml = null,
            RulePackInfo? rulePackProvenance = null,
            DvlRulePackSnapshot? rulePackSnapshot = null)
        {
            if (string.IsNullOrWhiteSpace(rulePackVersion))
                throw new ArgumentException("A Rule Pack version is required.", nameof(rulePackVersion));
            if (!CryptoUtils.IsValidSha256(rulePackSha))
                throw new ArgumentException("A full Rule Pack SHA-256 is required.", nameof(rulePackSha));

            string author = facts.TryGetValue("unit.detailer", out var af) ? af.Value?.ToString() ?? "Detailer" : "Detailer";
            string jobName = facts.TryGetValue("unit.jobName", out var jf) ? jf.Value?.ToString() ?? "AHU Project" : "AHU Project";
            string comNumber = facts.TryGetValue("unit.comNumber", out var cf) ? cf.Value?.ToString() ?? "COM-000000" : "COM-000000";

            string xmlSha = CryptoUtils.ComputeSha256(rawXml);

            if (sqItems.Count > 22)
                throw new ArgumentException("A DVL project supports at most 22 Special Quote slots.", nameof(sqItems));
            if (sqItems.Any(sq => sq.Slot < 1 || sq.Slot > 22))
                throw new ArgumentException("Special Quote slots must be between 1 and 22.", nameof(sqItems));
            if (sqItems.Select(sq => sq.Slot).Distinct().Count() != sqItems.Count)
                throw new ArgumentException("Special Quote slots must be unique.", nameof(sqItems));

            var identity = rulePackProvenance ?? new RulePackInfo
            {
                Version = rulePackVersion,
                Sha256 = rulePackSha
            };
            identity.Version = rulePackVersion;
            identity.Sha256 = rulePackSha;

            var project = new DvlProjectFile
            {
                FormatVersion = ApplicationVersion.DvlFormat,
                AppVersion = ApplicationVersion.Current,
                CreatedAt = DateTime.UtcNow.ToString("o"),
                LastSavedAt = DateTime.UtcNow.ToString("o"),
                Author = author,
                JobName = jobName,
                ComNumber = comNumber,
                RulePack = identity,
                RulePackSnapshot = rulePackSnapshot,
                SourceXml = new SourceXmlInfo
                {
                    FileName = string.IsNullOrWhiteSpace(sourceFileName) ? "Config.xml" : sourceFileName,
                    FileSha256 = xmlSha,
                    SchemaVersion = graph.DocumentVersion,
                    RawXml = rawXml,
                    IsUpzBundle = isUpzBundle,
                    OrderRevision = orderRevision,
                    RawOrderRevisionXml = rawOrderRevisionXml,
                    RawManifestXml = rawManifestXml
                },
                NormalizedGraph = graph,
                FactRegistry = facts,
                SqItems = sqItems,
                ChecklistInstances = checklists,
                GeneralComments = generalComments,
                Integrity = new DvlIntegrityInfo
                {
                    Algorithm = "dvl-canonical-json-v1",
                    SourceXmlSha256 = xmlSha,
                    State = rulePackSnapshot != null ? "complete" : "draft"
                }
            };

            project.Integrity!.CompleteStateSha256 = ComputeCompleteStateSha256(project);
            return project;
        }

        public void SaveToFile(DvlProjectFile project, string filePath)
        {
            if (project == null) throw new ArgumentNullException(nameof(project));
            if (!string.Equals(project.FormatVersion, ApplicationVersion.DvlFormat, StringComparison.Ordinal))
                throw new ArgumentException("Legacy DVL projects must be explicitly migrated before saving.", nameof(project));

            // A save is persistence, not a trust transition.  Validate the
            // caller's existing integrity before touching timestamps or writing
            // bytes; otherwise a tampered in-memory project could be blessed by
            // recomputing its hash here.
            ValidateV2ProjectForSave(project);
            project.LastSavedAt = DateTime.UtcNow.ToString("o");
            string json = JsonSerializer.Serialize(project, JsonOptions);
            SaveJsonToFile(json, filePath);
        }

        public void SaveJsonToFile(string json, string filePath)
        {
            if (string.IsNullOrWhiteSpace(filePath) || !Path.IsPathFullyQualified(filePath))
                throw new ArgumentException("DVL save path must be an absolute path selected by the user.", nameof(filePath));
            if (!string.Equals(Path.GetExtension(filePath), ".dvl", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("DVL save path must use the .dvl extension.", nameof(filePath));

            // The desktop bridge normally calls SaveToFile with a typed project.
            // Keep the raw JSON entry point for the legacy bridge contract, but
            // recognize DVL envelopes and validate v2 before any bytes are written.
            // This prevents a malformed or tampered project from being blessed by
            // the normal atomic-save path while preserving old opaque JSON callers.
            string validatedJson = ValidateJsonForSave(json);

            string fullPath = Path.GetFullPath(filePath);
            string? dir = Path.GetDirectoryName(fullPath);
            if (string.IsNullOrEmpty(dir))
                throw new InvalidOperationException("DVL save path has no parent directory.");
            Directory.CreateDirectory(dir);

            string tempPath = Path.Combine(dir, $".{Path.GetFileName(fullPath)}.{Guid.NewGuid():N}.tmp");
            try
            {
                byte[] bytes = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false).GetBytes(validatedJson);
                using (var stream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    stream.Write(bytes, 0, bytes.Length);
                    stream.Flush(flushToDisk: true);
                }
                File.Move(tempPath, fullPath, overwrite: true);
            }
            finally
            {
                if (File.Exists(tempPath))
                    File.Delete(tempPath);
            }
        }

        public DvlProjectFile LoadFromFile(string filePath)
        {
            if (!File.Exists(filePath))
                throw new FileNotFoundException("DVL project file not found.", filePath);

            string json = File.ReadAllText(filePath, Encoding.UTF8);
            return JsonSerializer.Deserialize<DvlProjectFile>(json, JsonOptions)
                ?? throw new InvalidOperationException("Failed to deserialize DVL project file.");
        }

        public DvlIntegrityValidationResult ValidateIntegrity(DvlProjectFile project, RulePackInfo? activeRulePack = null)
        {
            string actualSourceSha = CryptoUtils.ComputeSha256(project.SourceXml?.RawXml ?? "");
            bool sourceValid = CryptoUtils.IsValidSha256(project.SourceXml?.FileSha256);
            bool sourceMatches = sourceValid && string.Equals(actualSourceSha, project.SourceXml?.FileSha256, StringComparison.OrdinalIgnoreCase);
            if (project.Integrity == null || !CryptoUtils.IsValidSha256(project.Integrity.CompleteStateSha256))
            {
                return new DvlIntegrityValidationResult
                {
                    IsVerified = false,
                    CertificationAllowed = false,
                    State = sourceMatches ? "source-only" : "legacy",
                    Message = sourceMatches
                        ? "Only source XML integrity is available; complete saved verification state is unverified."
                        : "This project uses legacy or incomplete integrity metadata."
                };
            }

            var problems = new List<string>();
            if (!sourceMatches || !string.Equals(project.Integrity.SourceXmlSha256, actualSourceSha, StringComparison.OrdinalIgnoreCase))
                problems.Add("the embedded Config.xml hash does not match its contents");
            if (!string.Equals(ComputeCompleteStateSha256(project), project.Integrity.CompleteStateSha256, StringComparison.OrdinalIgnoreCase))
                problems.Add("the complete saved state hash does not match its contents");

            if (activeRulePack != null && (!string.Equals(project.RulePack.Version, activeRulePack.Version, StringComparison.Ordinal)
                || !string.Equals(project.RulePack.Sha256, activeRulePack.Sha256, StringComparison.OrdinalIgnoreCase)
                || (activeRulePack.RuleSemanticFingerprint != null && !string.Equals(project.RulePack.RuleSemanticFingerprint, activeRulePack.RuleSemanticFingerprint, StringComparison.OrdinalIgnoreCase))
                || (activeRulePack.TemplateSha256 != null && !string.Equals(project.RulePack.TemplateSha256, activeRulePack.TemplateSha256, StringComparison.OrdinalIgnoreCase))
                || (activeRulePack.TemplateMapSha256 != null && !string.Equals(project.RulePack.TemplateMapSha256, activeRulePack.TemplateMapSha256, StringComparison.OrdinalIgnoreCase))
                || (activeRulePack.ApprovedMappingsSha256 != null && !string.Equals(project.RulePack.ApprovedMappingsSha256, activeRulePack.ApprovedMappingsSha256, StringComparison.OrdinalIgnoreCase))))
                problems.Add($"the project is pinned to Rule Pack {project.RulePack.Version}, not the active {activeRulePack.Version}");

            if (project.RulePackSnapshot == null
                || !string.Equals(project.RulePackSnapshot.Version, project.RulePack.Version, StringComparison.Ordinal)
                || !string.Equals(project.RulePackSnapshot.BundleSha256, project.RulePack.Sha256, StringComparison.OrdinalIgnoreCase)
                || project.RulePackSnapshot.Rules == null
                || project.RulePackSnapshot.Rules.Count == 0
                || project.RulePackSnapshot.TemplateMap == null
                || project.RulePackSnapshot.ApprovedMappings.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null
                || !CryptoUtils.IsValidSha256(project.RulePack.TemplateSha256)
                || (!project.RulePackSnapshot.TemplateEmbedded && !project.RulePackSnapshot.TemplateRetrievable))
                problems.Add("the immutable Rule Pack snapshot or retrievable template artifact is unavailable");

            return problems.Count == 0
                ? new DvlIntegrityValidationResult { IsVerified = true, CertificationAllowed = true, State = "complete" }
                : new DvlIntegrityValidationResult
                {
                    IsVerified = false,
                    CertificationAllowed = false,
                    State = problems.Any(p => p.Contains("not the active", StringComparison.Ordinal))
                        ? "pack-mismatch"
                        : problems.Any(p => p.Contains("snapshot", StringComparison.Ordinal) || p.Contains("template artifact", StringComparison.Ordinal))
                            ? "artifact-unavailable"
                            : "tampered",
                    Message = $"This project is unverified because {string.Join(" and ", problems)}."
                };
        }

        public static string ComputeSha256(string content) => CryptoUtils.ComputeSha256(content);

        public static string ComputeFileSha256(string filePath) => CryptoUtils.ComputeFileSha256(filePath);

        /// <summary>
        /// Returns the deterministic UTF-8 JSON payload used for complete-state
        /// integrity. Integrity metadata and the mutable save timestamp are
        /// deliberately excluded so saving does not invalidate its own hash.
        /// </summary>
        public static string CanonicalizeProject(DvlProjectFile project)
        {
            return CanonicalizeJsonPayload(JsonSerializer.Serialize(project, JsonOptions));
        }

        /// <summary>
        /// Canonicalizes a DVL JSON payload using the same rules as the browser
        /// serializer: ordinal object-key ordering, preserved array ordering,
        /// and integrity/save-timestamp exclusion at the root.
        /// </summary>
        public static string CanonicalizeJsonPayload(string json)
        {
            using var document = JsonDocument.Parse(json);
            return CanonicalizeElement(document.RootElement, isRoot: true);
        }

        public static string ComputeCompleteStateSha256(DvlProjectFile project) =>
            CryptoUtils.ComputeSha256(CanonicalizeProject(project));

        private static string CanonicalizeElement(JsonElement element, bool isRoot = false)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    return "{" + string.Join(",", element.EnumerateObject()
                        .Where(p => !(isRoot && (p.NameEquals("integrity") || p.NameEquals("lastSavedAt"))))
                        .OrderBy(p => p.Name, StringComparer.Ordinal)
                        .Select(property => CanonicalizeJsonString(property.Name) + ":" + CanonicalizeElement(property.Value))) + "}";
                case JsonValueKind.Array:
                    return "[" + string.Join(",", element.EnumerateArray().Select(item => CanonicalizeElement(item))) + "]";
                case JsonValueKind.String:
                    return CanonicalizeJsonString(element.GetString());
                case JsonValueKind.Number:
                    return CanonicalizeJsonNumber(element);
                case JsonValueKind.True:
                    return "true";
                case JsonValueKind.False:
                    return "false";
                case JsonValueKind.Null:
                    return "null";
                default:
                    throw new InvalidOperationException($"Unsupported JSON value kind {element.ValueKind}.");
            }
        }

        /// <summary>
        /// Encodes a JSON string with the same well-formed Unicode behavior as
        /// JSON.stringify: valid surrogate pairs remain literal UTF-8, while
        /// lone surrogates are escaped so they cannot be replaced by U+FFFD.
        /// </summary>
        public static string CanonicalizeJsonString(string? value)
        {
            var builder = new StringBuilder((value?.Length ?? 0) + 2);
            builder.Append('"');
            if (value != null)
            {
                for (int index = 0; index < value.Length; index++)
                {
                    char character = value[index];
                    switch (character)
                    {
                        case '"': builder.Append("\\\""); continue;
                        case '\\': builder.Append("\\\\"); continue;
                        case '\b': builder.Append("\\b"); continue;
                        case '\f': builder.Append("\\f"); continue;
                        case '\n': builder.Append("\\n"); continue;
                        case '\r': builder.Append("\\r"); continue;
                        case '\t': builder.Append("\\t"); continue;
                    }

                    if (character < 0x20)
                    {
                        builder.Append("\\u");
                        builder.Append(((int)character).ToString("x4", CultureInfo.InvariantCulture));
                        continue;
                    }

                    if (char.IsHighSurrogate(character))
                    {
                        if (index + 1 < value.Length && char.IsLowSurrogate(value[index + 1]))
                        {
                            builder.Append(character);
                            builder.Append(value[++index]);
                        }
                        else
                        {
                            AppendUnicodeEscape(builder, character);
                        }
                        continue;
                    }

                    if (char.IsLowSurrogate(character))
                    {
                        AppendUnicodeEscape(builder, character);
                        continue;
                    }

                    builder.Append(character);
                }
            }
            builder.Append('"');
            return builder.ToString();
        }

        private static void AppendUnicodeEscape(StringBuilder builder, char character)
        {
            builder.Append("\\u");
            builder.Append(((int)character).ToString("x4", CultureInfo.InvariantCulture));
        }

        public string ValidateDvlJsonForSave(string json)
        {
            return ValidateJsonForSave(json);
        }

        // JSON.stringify serializes IEEE-754 numbers using the shortest
        // round-trippable representation, fixed notation for [1e-6, 1e21),
        // and lower-case scientific notation outside that interval.  The
        // default .NET formatter chooses different cutovers and exponent
        // spelling, so normalize explicitly for the cross-runtime DVL hash.
        public static string CanonicalizeJsonNumber(JsonElement element)
        {
            if (!element.TryGetDouble(out var number) || !double.IsFinite(number) || number == 0d)
                return "0";

            string raw = number.ToString("R", CultureInfo.InvariantCulture);
            bool negative = raw.StartsWith("-", StringComparison.Ordinal);
            if (negative) raw = raw[1..];

            int exponent = 0;
            int exponentIndex = raw.IndexOfAny(new[] { 'e', 'E' });
            if (exponentIndex >= 0)
            {
                exponent = int.Parse(raw[(exponentIndex + 1)..], CultureInfo.InvariantCulture);
                raw = raw[..exponentIndex];
            }

            int dotIndex = raw.IndexOf('.');
            int digitsBeforeDot = dotIndex >= 0 ? dotIndex : raw.Length;
            string digits = dotIndex >= 0 ? raw.Remove(dotIndex, 1) : raw;
            int firstNonZero = 0;
            while (firstNonZero < digits.Length && digits[firstNonZero] == '0') firstNonZero++;
            if (firstNonZero == digits.Length) return "0";
            digits = digits[firstNonZero..];
            int decimalPosition = digitsBeforeDot + exponent - firstNonZero;
            double absolute = Math.Abs(number);

            string result;
            if (absolute >= 1e-6 && absolute < 1e21)
            {
                if (decimalPosition <= 0)
                    result = "0." + new string('0', -decimalPosition) + digits;
                else if (decimalPosition >= digits.Length)
                    result = digits + new string('0', decimalPosition - digits.Length);
                else
                    result = digits[..decimalPosition] + "." + digits[decimalPosition..];
            }
            else
            {
                int scientificExponent = decimalPosition - 1;
                string mantissa = digits.Length == 1 ? digits : digits[0] + "." + digits[1..];
                result = mantissa + "e" + (scientificExponent >= 0 ? "+" : "") + scientificExponent.ToString(CultureInfo.InvariantCulture);
            }

            return negative ? "-" + result : result;
        }

        private string ValidateJsonForSave(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
                throw new ArgumentException("DVL JSON cannot be empty.", nameof(json));

            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                throw new ArgumentException("DVL JSON must contain an object.", nameof(json));

            if (!LooksLikeDvlEnvelope(document.RootElement))
                throw new ArgumentException("DVL JSON must contain a DVL project envelope.", nameof(json));

            var project = JsonSerializer.Deserialize<DvlProjectFile>(json, JsonOptions)
                ?? throw new ArgumentException("DVL JSON could not be deserialized.", nameof(json));

            if (project.FormatVersion.StartsWith("2.", StringComparison.Ordinal))
            {
                ValidateV2ProjectStructure(project);
                string canonical = CanonicalizeJsonPayload(json);
                string actualSourceSha = CryptoUtils.ComputeSha256(project.SourceXml.RawXml ?? "");
                if (project.Integrity == null
                    || !string.Equals(project.Integrity.Algorithm, "dvl-canonical-json-v1", StringComparison.Ordinal)
                    || !CryptoUtils.IsValidSha256(project.SourceXml.FileSha256)
                    || !string.Equals(actualSourceSha, project.SourceXml.FileSha256, StringComparison.OrdinalIgnoreCase)
                    || !CryptoUtils.IsValidSha256(project.Integrity.SourceXmlSha256)
                    || !string.Equals(actualSourceSha, project.Integrity.SourceXmlSha256, StringComparison.OrdinalIgnoreCase)
                    || !CryptoUtils.IsValidSha256(project.Integrity.CompleteStateSha256)
                    || !string.Equals(CryptoUtils.ComputeSha256(canonical), project.Integrity.CompleteStateSha256, StringComparison.OrdinalIgnoreCase))
                    throw new ArgumentException("DVL v2 complete-state integrity metadata does not match the submitted JSON payload.", nameof(json));
                return json;
            }

            // Legacy DVL envelopes may still be saved for migration purposes, but
            // an incoming complete-state hash is not silently accepted as valid.
            if (project.Integrity?.CompleteStateSha256 != null)
                throw new ArgumentException("Legacy DVL files cannot carry complete-state integrity metadata; migrate before saving.", nameof(json));
            ValidateSpecialQuotes(project.SqItems);
            return JsonSerializer.Serialize(project, JsonOptions);
        }

        private static bool LooksLikeDvlEnvelope(JsonElement root)
        {
            return root.TryGetProperty("formatVersion", out _)
                || root.TryGetProperty("sourceXml", out _)
                || root.TryGetProperty("rulePack", out _)
                || root.TryGetProperty("checklistInstances", out _);
        }

        private void ValidateV2ProjectForSave(DvlProjectFile project)
        {
            if (project.RulePack == null || string.IsNullOrWhiteSpace(project.RulePack.Version)
                || !CryptoUtils.IsValidSha256(project.RulePack.Sha256))
                throw new ArgumentException("DVL v2 projects require a Rule Pack version and full SHA-256.", nameof(project));
            if (project.SourceXml == null || project.NormalizedGraph == null
                || project.FactRegistry == null || project.SqItems == null || project.ChecklistInstances == null)
                throw new ArgumentException("DVL v2 projects require complete persisted state collections.", nameof(project));

            ValidateV2ProjectStructure(project);

            string actualSourceSha = CryptoUtils.ComputeSha256(project.SourceXml.RawXml ?? "");
            if (!CryptoUtils.IsValidSha256(project.SourceXml.FileSha256)
                || !string.Equals(actualSourceSha, project.SourceXml.FileSha256, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("DVL v2 source XML hash does not match its contents.", nameof(project));
            if (project.Integrity == null
                || !string.Equals(project.Integrity.Algorithm, "dvl-canonical-json-v1", StringComparison.Ordinal)
                || !CryptoUtils.IsValidSha256(project.Integrity.SourceXmlSha256)
                || !string.Equals(actualSourceSha, project.Integrity.SourceXmlSha256, StringComparison.OrdinalIgnoreCase)
                || !CryptoUtils.IsValidSha256(project.Integrity.CompleteStateSha256)
                || !string.Equals(ComputeCompleteStateSha256(project), project.Integrity.CompleteStateSha256, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("DVL v2 complete-state integrity metadata does not match the persisted contents.", nameof(project));
        }

        private static void ValidateV2ProjectStructure(DvlProjectFile project)
        {
            if (project == null)
                throw new ArgumentException("DVL v2 project cannot be null.", nameof(project));
            if (project.RulePack == null || string.IsNullOrWhiteSpace(project.RulePack.Version)
                || !CryptoUtils.IsValidSha256(project.RulePack.Sha256))
                throw new ArgumentException("DVL v2 projects require a Rule Pack version and full SHA-256.", nameof(project));
            if (project.SourceXml == null || project.NormalizedGraph == null
                || project.FactRegistry == null || project.SqItems == null || project.ChecklistInstances == null)
                throw new ArgumentException("DVL v2 projects require complete persisted state collections.", nameof(project));

            ValidateSpecialQuotes(project.SqItems);

            bool isCompleteState = string.Equals(project.Integrity?.State, "complete", StringComparison.OrdinalIgnoreCase);
            if (isCompleteState && project.RulePackSnapshot == null)
            {
                throw new ArgumentException("DVL v2 projects in complete state require an immutable Rule Pack snapshot; unavailable template artifacts remain non-certifying.", nameof(project));
            }

            if (project.RulePackSnapshot != null)
            {
                if (!string.Equals(project.RulePackSnapshot.Version, project.RulePack.Version, StringComparison.Ordinal)
                    || !string.Equals(project.RulePackSnapshot.BundleSha256, project.RulePack.Sha256, StringComparison.OrdinalIgnoreCase)
                    || project.RulePackSnapshot.Rules == null || project.RulePackSnapshot.Rules.Count == 0
                    || project.RulePackSnapshot.TemplateMap == null
                    || string.IsNullOrWhiteSpace(project.RulePackSnapshot.TemplateMap.TemplateVersion)
                    || project.RulePackSnapshot.ApprovedMappings.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null
                    || (isCompleteState && !CryptoUtils.IsValidSha256(project.RulePack.TemplateSha256))
                    || (isCompleteState && !CryptoUtils.IsValidSha256(project.RulePackSnapshot.TemplateSha256))
                    || (isCompleteState && !string.Equals(project.RulePackSnapshot.TemplateSha256, project.RulePack.TemplateSha256, StringComparison.OrdinalIgnoreCase))
                    || (project.RulePackSnapshot.TemplateEmbedded && string.IsNullOrWhiteSpace(project.RulePackSnapshot.Reproducibility)))
                {
                    throw new ArgumentException("DVL v2 Rule Pack snapshot is invalid; unavailable template artifacts remain non-certifying.", nameof(project));
                }
            }
        }

        private static void ValidateSpecialQuotes(List<SpecialQuote>? sqItems)
        {
            if (sqItems == null)
                throw new ArgumentException("DVL projects require a Special Quote collection.");
            if (sqItems.Count > 22)
                throw new ArgumentException("A DVL project supports at most 22 Special Quote slots.", nameof(sqItems));
            if (sqItems.Any(sq => sq.Slot < 1 || sq.Slot > 22))
                throw new ArgumentException("Special Quote slots must be between 1 and 22.", nameof(sqItems));
            if (sqItems.Select(sq => sq.Slot).Distinct().Count() != sqItems.Count)
                throw new ArgumentException("Special Quote slots must be unique.", nameof(sqItems));
        }
    }
}
