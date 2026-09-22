using System;
using System.IO;
using System.Linq;
using Xunit;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;

namespace AHUVerification.Tests
{
    public class RulePackManagerTests
    {
        private static readonly string[] ArtifactNames =
        {
            "rules.json",
            "template_map.json",
            "approved_mappings.json",
            "template.xlsx"
        };

        [Fact]
        public void LoadFromDirectory_ValidatesCompleteBundle()
        {
            var bundle = new RulePackManager().LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            Assert.True(bundle.IsValid);
            Assert.Equal(64, bundle.Manifest.BundleSha256.Length);
            Assert.True(bundle.Rules.Count > 0);
            Assert.True(bundle.ApprovedMappings.TryGetProperty("approvedSegments", out _));
            Assert.True(File.Exists(bundle.TemplatePath));
        }

        [Fact]
        public void LoadFromDirectory_AcceptsCrlfJsonCheckout()
        {
            string tempDirectory = CopyRulePackToTemp();
            try
            {
                foreach (string name in ArtifactNames.Where(name => name.EndsWith(".json", StringComparison.Ordinal)))
                {
                    string path = Path.Combine(tempDirectory, name);
                    string content = File.ReadAllText(path).Replace("\r\n", "\n", StringComparison.Ordinal);
                    File.WriteAllText(path, content.Replace("\n", "\r\n", StringComparison.Ordinal));
                }

                var bundle = new RulePackManager().LoadFromDirectory(tempDirectory);
                Assert.True(bundle.IsValid);
            }
            finally
            {
                Directory.Delete(tempDirectory, recursive: true);
            }
        }

        [Theory]
        [InlineData("rules.json")]
        [InlineData("template_map.json")]
        [InlineData("approved_mappings.json")]
        [InlineData("template.xlsx")]
        public void LoadFromDirectory_RejectsTamperedArtifact(string artifactName)
        {
            string tempDirectory = CopyRulePackToTemp();
            try
            {
                string path = Path.Combine(tempDirectory, artifactName);
                using (var stream = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.None))
                {
                    stream.WriteByte(0x20);
                }

                var error = Assert.Throws<InvalidOperationException>(() => new RulePackManager().LoadFromDirectory(tempDirectory));
                Assert.Contains(artifactName, error.Message, StringComparison.Ordinal);
            }
            finally
            {
                Directory.Delete(tempDirectory, recursive: true);
            }
        }

        [Theory]
        [InlineData("rules.json")]
        [InlineData("template_map.json")]
        [InlineData("approved_mappings.json")]
        [InlineData("template.xlsx")]
        public void LoadFromDirectory_RejectsMissingArtifact(string artifactName)
        {
            string tempDirectory = CopyRulePackToTemp();
            try
            {
                File.Delete(Path.Combine(tempDirectory, artifactName));
                Assert.Throws<FileNotFoundException>(() => new RulePackManager().LoadFromDirectory(tempDirectory));
            }
            finally
            {
                Directory.Delete(tempDirectory, recursive: true);
            }
        }

        [Fact]
        public void PublishToDirectory_GeneratesValidBundle_WithAccurateBundleSha()
        {
            var manager = new RulePackManager();
            var baseline = manager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            string tempPublishDir = Path.Combine(Path.GetTempPath(), $"ahu-published-rulepack-{Guid.NewGuid():N}");
            try
            {
                var modifiedRules = baseline.Rules.ToList();
                modifiedRules.Add(new Core.Models.RuleDefinition
                {
                    Id = "TEST-99",
                    SemanticKey = "TEST_CUSTOM_RULE",
                    Scope = Core.Models.RuleScope.Unit,
                    Category = "Base",
                    Text = "Test newly published rule verification.",
                    Order = 99
                });

                baseline.TemplateMap.RuleCellMappings["TEST_CUSTOM_RULE"] = new RuleCellMapping
                {
                    RuleId = "TEST-99",
                    Row = 100,
                    NaCell = "S100",
                    DetailerCell = "T100",
                    CheckerCell = "V100",
                    CommentsCell = "Y100",
                    InitialsCell = "Z100"
                };

                var publishedBundle = manager.PublishToDirectory(
                    tempPublishDir,
                    "15.0.0",
                    modifiedRules,
                    baseline.TemplateMap,
                    baseline.ApprovedMappings,
                    baseline.TemplatePath
                );

                Assert.True(publishedBundle.IsValid);
                Assert.Equal("15.0.0", publishedBundle.Manifest.Version);
                Assert.Equal(64, publishedBundle.Manifest.BundleSha256.Length);
                Assert.Contains(publishedBundle.Rules, r => r.Id == "TEST-99");

                // Verify reloading independently from disk
                var reloaded = manager.LoadFromDirectory(tempPublishDir);
                Assert.True(reloaded.IsValid);
                Assert.Equal(publishedBundle.Manifest.BundleSha256, reloaded.Manifest.BundleSha256);
            }
            finally
            {
                if (Directory.Exists(tempPublishDir))
                {
                    Directory.Delete(tempPublishDir, recursive: true);
                }
            }
        }

        [Fact]
        public void CheckRemoteUpdate_DetectsNewerVersionAndMissingRemote()
        {
            var manager = new RulePackManager();
            string baselinePath = TestPathHelper.GetRepoPath("resources/rulepack");
            var baseline = manager.LoadFromDirectory(baselinePath);

            // 1. Identical directory check -> No update
            var noUpdateRes = manager.CheckRemoteUpdate(baselinePath, baseline.Manifest.Version, baseline.Manifest.BundleSha256);
            Assert.False(noUpdateRes.HasUpdate);
            Assert.Null(noUpdateRes.Error);
            Assert.Equal(baseline.Manifest.Version, noUpdateRes.RemoteVersion);

            // 2. Outdated local version comparison -> Has update
            var hasUpdateRes = manager.CheckRemoteUpdate(baselinePath, "13.0.0", "old-sha-placeholder");
            Assert.True(hasUpdateRes.HasUpdate);
            Assert.Null(hasUpdateRes.Error);
            Assert.Equal(baseline.Manifest.Version, hasUpdateRes.RemoteVersion);
            Assert.Equal(baseline.Manifest.BundleSha256, hasUpdateRes.RemoteBundleSha256);

            // 3. Inaccessible path -> Error
            var missingRes = manager.CheckRemoteUpdate(@"Z:\NonExistentShare\RulePacks", "14.0.0", baseline.Manifest.BundleSha256);
            Assert.False(missingRes.HasUpdate);
            Assert.NotNull(missingRes.Error);
        }

        [Fact]
        public void SyncFromRemoteDetailed_ReturnsActionableError_WhenValidationFails()
        {
            var manager = new RulePackManager();
            string remoteTemp = CopyRulePackToTemp();
            string localStaging = Path.Combine(Path.GetTempPath(), $"staging-{Guid.NewGuid():N}");
            string localActive = Path.Combine(Path.GetTempPath(), $"active-{Guid.NewGuid():N}");
            string localLkg = Path.Combine(Path.GetTempPath(), $"lkg-{Guid.NewGuid():N}");

            try
            {
                // Corrupt template_map.json with empty generalFields (reproducing the P: drive issue)
                string tmPath = Path.Combine(remoteTemp, "template_map.json");
                string badTm = File.ReadAllText(tmPath).Replace("\"generalFields\": {", "\"generalFields\": {}, \"_orig\": {");
                File.WriteAllText(tmPath, badTm);

                var result = manager.SyncFromRemoteDetailed(remoteTemp, localStaging, localActive, localLkg);
                Assert.False(result.Success);
                Assert.NotNull(result.Error);
                Assert.Contains("Staged rule pack validation failed", result.Error);
            }
            finally
            {
                if (Directory.Exists(remoteTemp)) Directory.Delete(remoteTemp, true);
                if (Directory.Exists(localStaging)) Directory.Delete(localStaging, true);
                if (Directory.Exists(localActive)) Directory.Delete(localActive, true);
                if (Directory.Exists(localLkg)) Directory.Delete(localLkg, true);
            }
        }

        [Fact]
        public void SyncFromRemoteDetailed_ReturnsSuccess_WhenBundleIsValid()
        {
            var manager = new RulePackManager();
            string remoteTemp = CopyRulePackToTemp();
            string localStaging = Path.Combine(Path.GetTempPath(), $"staging-{Guid.NewGuid():N}");
            string localActive = Path.Combine(Path.GetTempPath(), $"active-{Guid.NewGuid():N}");
            string localLkg = Path.Combine(Path.GetTempPath(), $"lkg-{Guid.NewGuid():N}");

            try
            {
                var result = manager.SyncFromRemoteDetailed(remoteTemp, localStaging, localActive, localLkg);
                Assert.True(result.Success);
                Assert.Null(result.Error);
                Assert.True(Directory.Exists(localActive));
                Assert.True(File.Exists(Path.Combine(localActive, "manifest.json")));
            }
            finally
            {
                if (Directory.Exists(remoteTemp)) Directory.Delete(remoteTemp, true);
                if (Directory.Exists(localStaging)) Directory.Delete(localStaging, true);
                if (Directory.Exists(localActive)) Directory.Delete(localActive, true);
                if (Directory.Exists(localLkg)) Directory.Delete(localLkg, true);
            }
        }

        [Fact]
        public void P_DriveRulePack_LoadsAndValidatesCleanly()
        {
            string pPath = @"P:\Detailing\DVL Rulepack";
            if (!Directory.Exists(pPath)) return;

            var manager = new RulePackManager();
            var bundle = manager.LoadFromDirectory(pPath);
            Assert.True(bundle.IsValid);
            Assert.Equal("14.1.0", bundle.Manifest.Version);
            Assert.Equal(82, bundle.Rules.Count(r => r.IsArchived != true));
            Assert.True(bundle.TemplateMap.GeneralFields.Count > 0);

            string localStaging = Path.Combine(Path.GetTempPath(), $"staging-p-{Guid.NewGuid():N}");
            string localActive = Path.Combine(Path.GetTempPath(), $"active-p-{Guid.NewGuid():N}");
            string localLkg = Path.Combine(Path.GetTempPath(), $"lkg-p-{Guid.NewGuid():N}");
            try
            {
                var result = manager.SyncFromRemoteDetailed(pPath, localStaging, localActive, localLkg);
                Assert.True(result.Success, result.Error);
                Assert.Null(result.Error);
            }
            finally
            {
                if (Directory.Exists(localStaging)) Directory.Delete(localStaging, true);
                if (Directory.Exists(localActive)) Directory.Delete(localActive, true);
                if (Directory.Exists(localLkg)) Directory.Delete(localLkg, true);
            }
        }

        private static string CopyRulePackToTemp()
        {
            string destination = Path.Combine(Path.GetTempPath(), $"ahu-rulepack-{Guid.NewGuid():N}");
            Directory.CreateDirectory(destination);

            foreach (string sourcePath in Directory.GetFiles(TestPathHelper.GetRepoPath("resources/rulepack")))
            {
                File.Copy(sourcePath, Path.Combine(destination, Path.GetFileName(sourcePath)));
            }

            return destination;
        }
    }
}
