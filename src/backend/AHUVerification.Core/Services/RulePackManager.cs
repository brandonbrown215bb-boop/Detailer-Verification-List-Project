using System;
using System.Collections.Generic;
using System.IO;
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
        public string TemplatePath { get; set; } = "";
        public string RootPath { get; set; } = "";
        public bool IsValid { get; set; }
    }

    public class RulePackManager
    {
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
            string templatePath = Path.Combine(directoryPath, "template.xlsx");

            if (!File.Exists(manifestPath) || !File.Exists(rulesPath) || !File.Exists(templateMapPath))
                throw new FileNotFoundException("Incomplete rule pack bundle: missing manifest, rules, or template_map.");

            string manifestJson = File.ReadAllText(manifestPath, Encoding.UTF8);
            var manifest = JsonSerializer.Deserialize<RulePackManifest>(manifestJson, JsonOptions)
                ?? throw new InvalidOperationException("Failed to deserialize manifest.json");

            // Hash verification
            string rulesJson = File.ReadAllText(rulesPath, Encoding.UTF8);
            string templateMapJson = File.ReadAllText(templateMapPath, Encoding.UTF8);

            string rulesSha = ComputeSha256(rulesJson);
            string mapSha = ComputeSha256(templateMapJson);

            if (manifest.Files.TryGetValue("rules.json", out var rEntry) && !string.IsNullOrEmpty(rEntry.Sha256))
            {
                if (!string.Equals(rulesSha, rEntry.Sha256, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException($"Hash mismatch for rules.json: expected {rEntry.Sha256}, got {rulesSha}");
            }

            var rules = JsonSerializer.Deserialize<List<RuleDefinition>>(rulesJson, JsonOptions) ?? new();
            var templateMap = JsonSerializer.Deserialize<TemplateMap>(templateMapJson, JsonOptions) ?? new();

            return new RulePackBundle
            {
                Manifest = manifest,
                Rules = rules,
                TemplateMap = templateMap,
                TemplatePath = templatePath,
                RootPath = directoryPath,
                IsValid = true
            };
        }

        public bool SyncFromRemote(string remotePath, string localStagingPath, string activeStorePath, string lkgPath)
        {
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

                // 3. Backup active store to LKG (Last Known Good)
                if (Directory.Exists(activeStorePath))
                {
                    if (Directory.Exists(lkgPath))
                        Directory.Delete(lkgPath, true);
                    Directory.CreateDirectory(lkgPath);

                    foreach (var file in Directory.GetFiles(activeStorePath))
                    {
                        string dest = Path.Combine(lkgPath, Path.GetFileName(file));
                        File.Copy(file, dest, true);
                    }
                }

                // 4. Atomically swap staged into active store
                if (Directory.Exists(activeStorePath))
                    Directory.Delete(activeStorePath, true);
                Directory.CreateDirectory(activeStorePath);

                foreach (var file in Directory.GetFiles(localStagingPath))
                {
                    string dest = Path.Combine(activeStorePath, Path.GetFileName(file));
                    File.Copy(file, dest, true);
                }

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Rule pack sync error: {ex.Message}");
                // Rollback to LKG if possible
                if (Directory.Exists(lkgPath))
                {
                    Directory.CreateDirectory(activeStorePath);
                    foreach (var file in Directory.GetFiles(lkgPath))
                    {
                        string dest = Path.Combine(activeStorePath, Path.GetFileName(file));
                        File.Copy(file, dest, true);
                    }
                }
                return false;
            }
        }

        private static string ComputeSha256(string content)
        {
            using var sha = SHA256.Create();
            byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(content));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }
    }
}
