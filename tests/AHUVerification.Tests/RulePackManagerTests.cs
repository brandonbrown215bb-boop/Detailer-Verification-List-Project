using System;
using System.IO;
using System.Linq;
using Xunit;
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
            var bundle = new RulePackManager().LoadFromDirectory(TestPathHelper.GetRepoPath("src/rulepack"));

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

        private static string CopyRulePackToTemp()
        {
            string destination = Path.Combine(Path.GetTempPath(), $"ahu-rulepack-{Guid.NewGuid():N}");
            Directory.CreateDirectory(destination);

            foreach (string sourcePath in Directory.GetFiles(TestPathHelper.GetRepoPath("src/rulepack")))
            {
                File.Copy(sourcePath, Path.Combine(destination, Path.GetFileName(sourcePath)));
            }

            return destination;
        }
    }
}
