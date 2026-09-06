using System.IO;
using System.Text.Json;
using Xunit;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;

namespace AHUVerification.Tests
{
    public class SemanticFingerprintTests
    {
        [Fact]
        public void SemanticFingerprint_MatchesCrossRuntimeFixture()
        {
            string json = File.ReadAllText(TestPathHelper.GetFixturePath("semantic_fingerprint_cases.json"));
            using var doc = JsonDocument.Parse(json);
            foreach (var element in doc.RootElement.EnumerateArray())
            {
                var rule = JsonSerializer.Deserialize<RuleDefinition>(element.GetProperty("rule").GetRawText(), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                string expected = element.GetProperty("expected").GetString();
                string actual = AstRuleEvaluator.ComputeSemanticFingerprint(rule);
                Assert.Equal(expected, actual);
            }
        }
    }
}
