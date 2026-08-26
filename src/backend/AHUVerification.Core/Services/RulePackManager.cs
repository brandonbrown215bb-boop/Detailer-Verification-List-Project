using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Services
{
    public class RulePackBundle
    {
        public RulePackManifest Manifest { get; set; } = new();
        public List<RuleDefinition> Rules { get; set; } = new();
        public TemplateMap TemplateMap { get; set; } = new();
        public JsonElement ApprovedMappings { get; set; }
        public string TemplatePath { get; set; } = "";
        public string RootPath { get; set; } = "";
        public bool IsValid { get; set; }
    }

    public class RulePackManager
    {
        private static readonly string[] RequiredArtifactNames =
        {
            "rules.json",
            "template_map.json",
            "approved_mappings.json",
            "template.xlsx"
        };

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        public RulePackBundle LoadFromDirectory(string directoryPath)
        {
            if (!Directory.Exists(directoryPath))
                throw new DirectoryNotFoundException($"Rule pack directory not found: {directoryPath}");

            string manifestPath = Path.Combine(directoryPath, "manifest.json");
            string rulesPath = Path.Combine(directoryPath, "rules.json");
            string templateMapPath = Path.Combine(directoryPath, "template_map.json");
            string approvedMappingsPath = Path.Combine(directoryPath, "approved_mappings.json");
            string templatePath = Path.Combine(directoryPath, "template.xlsx");

            if (!File.Exists(manifestPath))
                throw new FileNotFoundException("Incomplete rule pack bundle: missing manifest.json.", manifestPath);

            foreach (string artifactName in RequiredArtifactNames)
            {
                string artifactPath = Path.Combine(directoryPath, artifactName);
                if (!File.Exists(artifactPath))
                    throw new FileNotFoundException($"Incomplete rule pack bundle: missing {artifactName}.", artifactPath);
            }

            string manifestJson = File.ReadAllText(manifestPath, Encoding.UTF8);
            var manifest = JsonSerializer.Deserialize<RulePackManifest>(manifestJson, JsonOptions)
                ?? throw new InvalidOperationException("Failed to deserialize manifest.json");

            string rulesJson = File.ReadAllText(rulesPath, Encoding.UTF8);
            string templateMapJson = File.ReadAllText(templateMapPath, Encoding.UTF8);
            string approvedMappingsJson = File.ReadAllText(approvedMappingsPath, Encoding.UTF8);

            var actualHashes = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["rules.json"] = ComputeCanonicalJsonSha256(rulesJson),
                ["template_map.json"] = ComputeCanonicalJsonSha256(templateMapJson),
                ["approved_mappings.json"] = ComputeCanonicalJsonSha256(approvedMappingsJson),
                ["template.xlsx"] = ComputeFileSha256(templatePath)
            };

            foreach (string artifactName in RequiredArtifactNames)
            {
                if (!manifest.Files.TryGetValue(artifactName, out var entry))
                    throw new InvalidOperationException($"Manifest is missing the required {artifactName} entry.");
                if (!IsFullSha256(entry.Sha256))
                    throw new InvalidOperationException($"Manifest contains an invalid SHA-256 for {artifactName}.");
                if (!string.Equals(actualHashes[artifactName], entry.Sha256, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException($"Hash mismatch for {artifactName}: expected {entry.Sha256}, got {actualHashes[artifactName]}");
            }

            string bundleSha = ComputeBundleSha256(actualHashes);
            if (!IsFullSha256(manifest.BundleSha256))
                throw new InvalidOperationException("Manifest contains an invalid bundleSha256.");
            if (!string.Equals(bundleSha, manifest.BundleSha256, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException($"Rule pack bundle hash mismatch: expected {manifest.BundleSha256}, got {bundleSha}");

            var rules = JsonSerializer.Deserialize<List<RuleDefinition>>(rulesJson, JsonOptions) ?? new();
            var templateMap = JsonSerializer.Deserialize<TemplateMap>(templateMapJson, JsonOptions) ?? new();
            var approvedMappings = JsonSerializer.Deserialize<JsonElement>(approvedMappingsJson, JsonOptions);

            return new RulePackBundle
            {
                Manifest = manifest,
                Rules = rules,
                TemplateMap = templateMap,
                ApprovedMappings = approvedMappings.Clone(),
                TemplatePath = templatePath,
                RootPath = directoryPath,
                IsValid = true
            };
        }

        public bool SyncFromRemote(string remotePath, string localStagingPath, string activeStorePath, string lkgPath)
        {
            bool activeMovedToLkg = false;
            try
            {
                if (!Directory.Exists(remotePath)) return false;

                // 1. Download to local staging directory
                if (Directory.Exists(localStagingPath))
                    Directory.Delete(localStagingPath, true);
                Directory.CreateDirectory(localStagingPath);

                foreach (var file in Directory.GetFiles(remotePath))
                {
                    string dest = Path.Combine(localStagingPath, Path.GetFileName(file));
                    File.Copy(file, dest, true);
                }

                // 2. Validate staged rule pack
                var staged = LoadFromDirectory(localStagingPath);
                if (!staged.IsValid) return false;

                // 3. Rename the active store to LKG on the same local volume.
                if (Directory.Exists(activeStorePath))
                {
                    if (Directory.Exists(lkgPath))
                        Directory.Delete(lkgPath, true);
                    Directory.Move(activeStorePath, lkgPath);
                    activeMovedToLkg = true;
                }

                // 4. Promote the already-validated staging directory with a rename.
                Directory.Move(localStagingPath, activeStorePath);

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Rule pack sync error: {ex.Message}");
                // Roll back only when this attempt moved the previous active pack.
                if (activeMovedToLkg && Directory.Exists(lkgPath))
                {
                    if (Directory.Exists(activeStorePath))
                        Directory.Delete(activeStorePath, true);
                    Directory.Move(lkgPath, activeStorePath);
                }
                return false;
            }
        }

        public RulePackBundle PublishToDirectory(
            string destinationDirectory,
            string version,
            List<RuleDefinition> rules,
            TemplateMap templateMap,
            JsonElement approvedMappings,
            string templateXlsxSourcePath)
        {
            if (!File.Exists(templateXlsxSourcePath))
                throw new FileNotFoundException($"Template Excel file not found: {templateXlsxSourcePath}");

            Directory.CreateDirectory(destinationDirectory);

            var writeOptions = new JsonSerializerOptions
            {
                WriteIndented = true,
                Converters = { new JsonStringEnumConverter() }
            };

            string rulesJson = JsonSerializer.Serialize(rules, writeOptions);
            string templateMapJson = JsonSerializer.Serialize(templateMap, writeOptions);
            string approvedMappingsJson = JsonSerializer.Serialize(approvedMappings, writeOptions);

            // Normalize line endings to LF
            rulesJson = rulesJson.Replace("\r\n", "\n").Replace('\r', '\n');
            templateMapJson = templateMapJson.Replace("\r\n", "\n").Replace('\r', '\n');
            approvedMappingsJson = approvedMappingsJson.Replace("\r\n", "\n").Replace('\r', '\n');

            string rulesPath = Path.Combine(destinationDirectory, "rules.json");
            string templateMapPath = Path.Combine(destinationDirectory, "template_map.json");
            string approvedMappingsPath = Path.Combine(destinationDirectory, "approved_mappings.json");
            string templateDestPath = Path.Combine(destinationDirectory, "template.xlsx");
            string manifestPath = Path.Combine(destinationDirectory, "manifest.json");

            File.WriteAllText(rulesPath, rulesJson, new UTF8Encoding(false));
            File.WriteAllText(templateMapPath, templateMapJson, new UTF8Encoding(false));
            File.WriteAllText(approvedMappingsPath, approvedMappingsJson, new UTF8Encoding(false));

            if (!string.Equals(Path.GetFullPath(templateXlsxSourcePath), Path.GetFullPath(templateDestPath), StringComparison.OrdinalIgnoreCase))
            {
                File.Copy(templateXlsxSourcePath, templateDestPath, true);
            }

            int activeRules = rules.Count(r => r.IsArchived != true);
            int archivedRules = rules.Count(r => r.IsArchived == true);

            var actualHashes = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["rules.json"] = ComputeCanonicalJsonSha256(rulesJson),
                ["template_map.json"] = ComputeCanonicalJsonSha256(templateMapJson),
                ["approved_mappings.json"] = ComputeCanonicalJsonSha256(approvedMappingsJson),
                ["template.xlsx"] = ComputeFileSha256(templateDestPath)
            };

            string bundleSha = ComputeBundleSha256(actualHashes);

            var manifest = new RulePackManifest
            {
                Name = "AHU Detailing Verification Rule Pack",
                Version = version,
                GeneratedAt = DateTime.UtcNow.ToString("o"),
                BundleSha256 = bundleSha,
                Files = new Dictionary<string, RulePackManifestFileEntry>
                {
                    ["rules.json"] = new RulePackManifestFileEntry
                    {
                        Sha256 = actualHashes["rules.json"],
                        TotalRules = rules.Count,
                        ActiveRules = activeRules,
                        ArchivedRules = archivedRules
                    },
                    ["template_map.json"] = new RulePackManifestFileEntry
                    {
                        Sha256 = actualHashes["template_map.json"]
                    },
                    ["approved_mappings.json"] = new RulePackManifestFileEntry
                    {
                        Sha256 = actualHashes["approved_mappings.json"]
                    },
                    ["template.xlsx"] = new RulePackManifestFileEntry
                    {
                        Sha256 = actualHashes["template.xlsx"]
                    }
                }
            };

            string manifestJson = JsonSerializer.Serialize(manifest, writeOptions);
            manifestJson = manifestJson.Replace("\r\n", "\n").Replace('\r', '\n');
            File.WriteAllText(manifestPath, manifestJson, new UTF8Encoding(false));

            // Validate the written package to be 100% sure
            return LoadFromDirectory(destinationDirectory);
        }

        private static string ComputeCanonicalJsonSha256(string content)
        {
            string canonicalText = content.Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n');
            return ComputeSha256(Encoding.UTF8.GetBytes(canonicalText));
        }

        private static string ComputeBundleSha256(IReadOnlyDictionary<string, string> hashes)
        {
            string identity = string.Join("\n", RequiredArtifactNames.Select(name => $"{name}:{hashes[name].ToLowerInvariant()}"));
            return ComputeSha256(Encoding.UTF8.GetBytes(identity));
        }

        private static string ComputeFileSha256(string filePath)
        {
            using var stream = File.OpenRead(filePath);
            return ComputeSha256(stream);
        }

        private static string ComputeSha256(byte[] bytes)
        {
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(bytes)).ToLowerInvariant();
        }

        private static string ComputeSha256(Stream stream)
        {
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(stream)).ToLowerInvariant();
        }

        private static bool IsFullSha256(string value)
        {
            return !string.IsNullOrEmpty(value) && value.Length == 64 && value.All(Uri.IsHexDigit);
        }
    }
}
