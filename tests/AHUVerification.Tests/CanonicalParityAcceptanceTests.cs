using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Xunit;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;
using AHUVerification.Core.Utils;
using AHUVerification.Core.Parsers;

namespace AHUVerification.Tests;

/// <summary>Canonical serialization, predicate semantics, and integrity acceptance tests.</summary>
public class CanonicalParityAcceptanceTests
{
    [Theory]
    [InlineData("{\"b\":42.0,\"a\":4.2e1,\"zero\":-0.0}", "{\"a\":42,\"b\":42,\"zero\":0}")]
    [InlineData("{\"small\":1e-7,\"decimal\":0.000001,\"large\":1e21,\"integer\":1e20}", "{\"decimal\":0.000001,\"integer\":100000000000000000000,\"large\":1e+21,\"small\":1e-7}")]
    [InlineData("{\"text\":\"é 😀 <&> \\n\",\"nested\":{\"integrity\":\"keep\"},\"integrity\":\"omit\",\"lastSavedAt\":\"omit\"}", "{\"nested\":{\"integrity\":\"keep\"},\"text\":\"é 😀 <&> \\n\"}")]
    [InlineData("{\"10\":\"ten\",\"2\":\"two\",\"a\":[null,true,false]}", "{\"10\":\"ten\",\"2\":\"two\",\"a\":[null,true,false]}")]
    public void DvlCanonicalPayload_MatchesSpecification(string json, string expected)
    {
        Assert.Equal(expected, DvlProjectManager.CanonicalizeJsonPayload(json));
    }

    [Theory]
    [InlineData("Confirm < 10 & inspect café 😀", 0.0000001, "{\"allowNA\":false,\"instructions\":\"Confirm < 10 & inspect café 😀\",\"predicate\":{\">\":[{\"var\":\"unit.weight\"},1e-7]},\"requiredFacts\":[\"casing.floorMaterial\",\"unit.knockdown\"],\"scope\":\"Unit\",\"verificationMode\":\"ManualCheck\"}")]
    [InlineData("Confirm measurement", 1000000000000000000000d, "{\"allowNA\":false,\"instructions\":\"Confirm measurement\",\"predicate\":{\">\":[{\"var\":\"unit.weight\"},1e+21]},\"requiredFacts\":[\"casing.floorMaterial\",\"unit.knockdown\"],\"scope\":\"Unit\",\"verificationMode\":\"ManualCheck\"}")]
    public void SemanticFingerprint_MatchesExpectedCanonicalFingerprint(string instructions, double threshold, string expected)
    {
        var rule = new
        {
            id = "PARITY",
            semanticKey = "PARITY",
            scope = "Unit",
            category = "Housing",
            order = 1,
            text = instructions,
            requiredFacts = new[] { "unit.knockdown", "unit.floorMaterial" },
            predicate = new Dictionary<string, object> { [">"] = new object[] { new { var = "unit.weight" }, threshold } },
            allowNA = false,
            verificationMode = "ManualCheck"
        };
        var typed = JsonSerializer.Deserialize<RuleDefinition>(JsonSerializer.Serialize(rule), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        Assert.Equal(expected, AstRuleEvaluator.ComputeSemanticFingerprint(typed));
    }

    [Fact]
    public void CanonicalDvl_PreservesCompleteStateAcrossNativeSave()
    {
        var manager = new DvlProjectManager();
        var bundle = new RulePackManager().LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));
        var project = manager.CreateProject(
            new NormalizedXmlGraph { UnitMOMID = "manual-unit", Dimensions = new() { Height = 96, Length = 120, Width = 84 } },
            new Dictionary<string, Fact>
            {
                ["unit.jobName"] = new Fact { Key = "unit.jobName", Value = "Parity fixture" },
                ["unit.comNumber"] = new Fact { Key = "unit.comNumber", Value = "TEST-ONLY" },
                ["unit.detailer"] = new Fact { Key = "unit.detailer", Value = "Test" }
            },
            new List<SpecialQuote>(),
            new List<ChecklistInstance>(),
            "<Manual />",
            bundle,
            "Round-trip café 😀",
            sourceFileName: "Manual Unit",
            isUpzBundle: false);

        string expectedSha = project.Integrity.CompleteStateSha256!;
        string path = Path.Combine(Path.GetTempPath(), $"dvl-canonical-{Guid.NewGuid():N}.dvl");
        try
        {
            manager.SaveToFile(project, path);
            using var saved = JsonDocument.Parse(File.ReadAllText(path));
            Assert.Equal(expectedSha, saved.RootElement.GetProperty("integrity").GetProperty("completeStateSha256").GetString());
            Assert.Equal(expectedSha, DvlProjectManager.ComputeSha256(DvlProjectManager.CanonicalizeJsonPayload(saved.RootElement.GetRawText())));
            Assert.Equal("Round-trip café 😀", saved.RootElement.GetProperty("generalComments").GetString());
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }

    [Theory]
    [InlineData("{\">\":[{\"var\":\"unit.weight\"},-1]}", "null", false, true)]
    [InlineData("{\">\":[{\"var\":\"unit.weight\"},-1]}", "\"\"", false, true)]
    [InlineData("{\">\":[{\"var\":\"unit.weight\"},-1]}", "false", false, true)]
    [InlineData("{\"===\":[{\"var\":\"unit.weight\"},1.00001]}", "1.0", false, false)]
    public void PredicateSemantics_AgreeWithoutFabricatingNumericValues(string predicateJson, string valueJson, bool expectedResult, bool expectedNeedsInput)
    {
        using var valueDocument = JsonDocument.Parse(valueJson);
        var value = valueDocument.RootElement;
        object? native = value.ValueKind switch
        {
            JsonValueKind.Number => value.GetDouble(),
            JsonValueKind.String => value.GetString(),
            JsonValueKind.False => false,
            _ => null
        };
        var context = new Dictionary<string, object?> { ["unit.weight"] = native };
        var predicate = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(predicateJson)!;
        var actual = new AstRuleEvaluator().EvaluatePredicate(predicate, context, new(), new());
        Assert.Equal(expectedResult, actual.Result);
        Assert.Equal(expectedNeedsInput, actual.NeedsInput);
    }

    [Theory]
    [InlineData("<unitRevision><unitWeight>42</unitWeight></unitRevision>", 42.0)]
    [InlineData("<unitRevision><unitWeight>invalid</unitWeight><unitOptions><unitConstructionType>unknown</unitConstructionType></unitOptions></unitRevision>", null)]
    public void SparseSource_ParsesAndExtractsGracefully(string xml, double? expectedWeight)
    {
        var graph = new NormalizedXmlParser().Parse(xml);
        var facts = new FactExtractor().ExtractFacts(graph);
        Assert.NotNull(graph);
        Assert.NotNull(facts);
        if (expectedWeight.HasValue)
        {
            Assert.Equal(expectedWeight.Value, graph.UnitWeight);
        }
        else
        {
            Assert.Equal(0, graph.UnitWeight);
        }
    }
}
