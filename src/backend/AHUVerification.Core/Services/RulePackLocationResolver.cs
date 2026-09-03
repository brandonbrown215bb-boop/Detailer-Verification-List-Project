using System;
using System.Collections.Generic;
using System.IO;

namespace AHUVerification.Core.Services
{
    public class ResolvedRulePackLocation
    {
        public string? Path { get; set; }
        public bool IsAutoDetected { get; set; }
        public string SourceType { get; set; } = "None"; // "Configured", "SharePointSync", "OneDrive", "Environment", "None"
    }

    public static class RulePackLocationResolver
    {
        public static readonly string[] RelativeCandidateSubpaths = new[]
        {
            Path.Combine("UNIT DETAILING VERIFICATION LIST", "RulePack"),
            "UNIT DETAILING VERIFICATION LIST",
            Path.Combine("Detailing - Documents", "UNIT DETAILING VERIFICATION LIST", "RulePack"),
            Path.Combine("Detailing - Documents", "UNIT DETAILING VERIFICATION LIST"),
            Path.Combine("Detailing - UNIT DETAILING VERIFICATION LIST", "RulePack"),
            "Detailing - UNIT DETAILING VERIFICATION LIST",
            Path.Combine("Documents", "UNIT DETAILING VERIFICATION LIST", "RulePack"),
            Path.Combine("Documents", "UNIT DETAILING VERIFICATION LIST")
        };

        public static ResolvedRulePackLocation ResolveLocation(
            string? configuredPath = null,
            Func<string, string?>? envGetter = null,
            Func<string, bool>? dirExists = null,
            Func<string, bool>? fileExists = null)
        {
            var getEnv = envGetter ?? (key => Environment.GetEnvironmentVariable(key));
            var checkDir = dirExists ?? Directory.Exists;
            var checkFile = fileExists ?? File.Exists;

            // 1. Explicitly configured path from Settings / localStorage
            if (!string.IsNullOrWhiteSpace(configuredPath))
            {
                string trimmed = configuredPath.Trim();
                if (checkDir(trimmed) && checkFile(Path.Combine(trimmed, "manifest.json")))
                {
                    return new ResolvedRulePackLocation
                    {
                        Path = trimmed,
                        IsAutoDetected = false,
                        SourceType = "Configured"
                    };
                }
            }

            // 2. Custom Environment Variable
            string? customEnv = getEnv("DVL_RULEPACK_PATH");
            if (!string.IsNullOrWhiteSpace(customEnv) && checkDir(customEnv) && checkFile(Path.Combine(customEnv, "manifest.json")))
            {
                return new ResolvedRulePackLocation
                {
                    Path = customEnv,
                    IsAutoDetected = true,
                    SourceType = "Environment"
                };
            }

            // 3. Probing Corporate OneDrive / SharePoint root directories
            var candidateRoots = new List<(string RootPath, string SourceType)>();

            string? oneDriveCommercial = getEnv("OneDriveCommercial");
            if (!string.IsNullOrWhiteSpace(oneDriveCommercial) && checkDir(oneDriveCommercial))
            {
                candidateRoots.Add((oneDriveCommercial, "SharePointSync"));
            }

            string userProfile = getEnv("USERPROFILE") ?? "";
            if (!string.IsNullOrWhiteSpace(userProfile))
            {
                string jciRoot = Path.Combine(userProfile, "Johnson Controls");
                if (checkDir(jciRoot)) candidateRoots.Add((jciRoot, "SharePointSync"));

                string oneDriveJci = Path.Combine(userProfile, "OneDrive - Johnson Controls");
                if (checkDir(oneDriveJci)) candidateRoots.Add((oneDriveJci, "SharePointSync"));
            }

            string? genericOneDrive = getEnv("OneDrive");
            if (!string.IsNullOrWhiteSpace(genericOneDrive) && checkDir(genericOneDrive))
            {
                candidateRoots.Add((genericOneDrive, "OneDrive"));
            }

            foreach (var (root, sourceType) in candidateRoots)
            {
                foreach (var rel in RelativeCandidateSubpaths)
                {
                    string candidate = Path.Combine(root, rel);
                    if (checkDir(candidate) && checkFile(Path.Combine(candidate, "manifest.json")))
                    {
                        return new ResolvedRulePackLocation
                        {
                            Path = candidate,
                            IsAutoDetected = true,
                            SourceType = sourceType
                        };
                    }
                }
            }

            return new ResolvedRulePackLocation
            {
                Path = null,
                IsAutoDetected = false,
                SourceType = "None"
            };
        }
    }
}

