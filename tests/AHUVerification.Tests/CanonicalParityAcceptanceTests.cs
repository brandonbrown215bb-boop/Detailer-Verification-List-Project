using System.Diagnostics;
using System.Text.Json;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;
using AHUVerification.Core.Utils;
using AHUVerification.Core.Parsers;

namespace AHUVerification.Tests;

/// <summary>Cross-runtime integration checks against actual Node/TypeScript production code.</summary>
public class CanonicalParityAcceptanceTests
{
    private static JsonElement RunTypeScript(object request)
    {
        var start = new ProcessStartInfo("node")
        {
            WorkingDirectory = TestPathHelper.GetRepoPath(""),
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardInputEncoding = new System.Text.UTF8Encoding(false),
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            StandardErrorEncoding = System.Text.Encoding.UTF8,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        start.ArgumentList.Add(TestPathHelper.GetRepoPath("scripts/test_cross_runtime_parity.mjs"));
        using var process = Process.Start(start) ?? throw new InvalidOperationException("Node could not start.");
        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        process.StandardInput.Write(JsonSerializer.Serialize(request));
        process.StandardInput.Close();
        if (!process.WaitForExit(60_000))
        {
            process.Kill(entireProcessTree: true);
            throw new TimeoutException("TypeScript parity probe exceeded 60 seconds.");
        }
        Assert.True(process.ExitCode == 0, error.GetAwaiter().GetResult());
        using var document = JsonDocument.Parse(output.GetAwaiter().GetResult());
        return document.RootElement.Clone();
    }

    [Theory]
    [InlineData("{\"b\":42.0,\"a\":4.2e1,\"zero\":-0.0}")]
    [InlineData("{\"small\":1e-7,\"decimal\":0.000001,\"large\":1e21,\"integer\":1e20}")]
    [InlineData("{\"text\":\"é 😀 <&> \\n\",\"nested\":{\"integrity\":\"keep\"},\"integrity\":\"omit\",\"lastSavedAt\":\"omit\"}")]
    [InlineData("{\"10\":\"ten\",\"2\":\"two\",\"a\":[null,true,false]}")]
    public void DvlCanonicalPayload_MatchesProductionTypeScript(string json)
    {
        string expected = RunTypeScript(new { operation = "canonical", json }).GetString()!;
        Assert.Equal(expected, DvlProjectManager.CanonicalizeJsonPayload(json));
    }

    [Theory]
    [InlineData("Confirm < 10 & inspect café 😀", 0.0000001)]
    [InlineData("Confirm measurement", 1000000000000000000000d)]
    public void SemanticFingerprint_MatchesProductionTypeScript(string instructions, double threshold)
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
        string expected = RunTypeScript(new { operation = "fingerprint", rule }).GetString()!;
        Assert.Equal(expected, AstRuleEvaluator.ComputeSemanticFingerprint(typed));
    }

    [Fact]
    public void TypeScriptCreatedDvl_PreservesCompleteStateAcrossNativeSave()
    {
        var project = RunTypeScript(new { operation = "project" });
        string json = project.GetRawText();
        string expected = project.GetProperty("integrity").GetProperty("completeStateSha256").GetString()!;
        Assert.Equal(expected, DvlProjectManager.ComputeSha256(DvlProjectManager.CanonicalizeJsonPayload(json)));
        string path = Path.Combine(Path.GetTempPath(), $"dvl-parity-{Guid.NewGuid():N}.dvl");
        try
        {
            var manager = new DvlProjectManager();
            manager.SaveJsonToFile(json, path);
            using var saved = JsonDocument.Parse(File.ReadAllText(path));
            Assert.Equal(expected, saved.RootElement.GetProperty("integrity").GetProperty("completeStateSha256").GetString());
            Assert.Equal(expected, DvlProjectManager.ComputeSha256(DvlProjectManager.CanonicalizeJsonPayload(saved.RootElement.GetRawText())));
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
        var preview = RunTypeScript(new { operation = "predicate", predicate, context, requiredFacts = Array.Empty<string>(), facts = new { } });
        Assert.Equal(expectedResult, actual.Result);
        Assert.Equal(expectedNeedsInput, actual.NeedsInput);
        Assert.Equal(expectedResult, preview.GetProperty("result").GetBoolean());
        Assert.Equal(expectedNeedsInput, preview.GetProperty("needsInput").GetBoolean());
    }

    [Theory]
    [InlineData("<unitRevision><unitWeight>42</unitWeight></unitRevision>")]
    [InlineData("<unitRevision><unitWeight>invalid</unitWeight><unitOptions><unitConstructionType>unknown</unitConstructionType></unitOptions></unitRevision>")]
    public void SparseSource_ProductionBrowserAndNativeContractsAgree(string xml)
    {
        var preview = RunTypeScript(new { operation = "extract", xml });
        var graph = new NormalizedXmlParser().Parse(xml);
        var native = JsonSerializer.SerializeToElement(new { graph, facts = new FactExtractor().ExtractFacts(graph) }, JsonDefaults.CreateFlexibleOptions());
        var differences = new List<string>();
        Compare(preview, native, "$", differences);
        Assert.True(differences.Count == 0, string.Join(Environment.NewLine, differences.Take(50)));
    }

    private static void Compare(JsonElement expected, JsonElement actual, string path, List<string> differences)
    {
        // Optional absent fields and explicit null carry the same domain meaning;
        // every present value, collection, provenance field and ordering is compared.
        bool expectedNull = expected.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined;
        bool actualNull = actual.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined;
        if (expectedNull && actualNull) return;
        if (expected.ValueKind != actual.ValueKind)
        {
            differences.Add($"{path}: browser {expected.ValueKind}, native {actual.ValueKind}");
            return;
        }
        if (expected.ValueKind == JsonValueKind.Object)
        {
            foreach (string key in expected.EnumerateObject().Select(p => p.Name).Union(actual.EnumerateObject().Select(p => p.Name)).Order())
            {
                expected.TryGetProperty(key, out var left);
                actual.TryGetProperty(key, out var right);
                Compare(left, right, path + "." + key, differences);
            }
        }
        else if (expected.ValueKind == JsonValueKind.Array)
        {
            if (expected.GetArrayLength() != actual.GetArrayLength()) differences.Add($"{path}: array lengths differ");
            for (int index = 0; index < Math.Min(expected.GetArrayLength(), actual.GetArrayLength()); index++)
                Compare(expected[index], actual[index], $"{path}[{index}]", differences);
        }
        else if (expected.ValueKind == JsonValueKind.Number)
        {
            if (expected.GetDouble() != actual.GetDouble()) differences.Add($"{path}: browser {expected}, native {actual}");
        }
        else if (expected.ToString() != actual.ToString()) differences.Add($"{path}: browser {expected}, native {actual}");
    }
}
