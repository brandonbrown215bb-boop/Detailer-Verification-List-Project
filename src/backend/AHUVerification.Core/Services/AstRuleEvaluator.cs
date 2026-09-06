using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.Encodings.Web;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Services
{
    public class AstRuleEvaluator
    {
        private static readonly JsonSerializerOptions CanonicalJsonOptions = new()
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };
        public class EvalResult
        {
            public bool Result { get; set; }
            public bool NeedsInput { get; set; }
            public string Trace { get; set; } = "";
        }

        public EvalResult EvaluatePredicate(
            Dictionary<string, JsonElement>? predicate,
            Dictionary<string, object?> context,
            List<string> requiredFacts,
            Dictionary<string, Fact> factRegistry)
        {
            // Check if any required fact is Unknown or RequiresConfirmation
            string? skidId = context.TryGetValue("__skidId", out var sObj) ? sObj?.ToString() : null;
            foreach (var fKey in requiredFacts)
            {
                string canonicalKey = FactContractValidator.CanonicalizeKey(fKey);
                string mappedKey = canonicalKey.StartsWith("skid.") && skidId != null
                    ? canonicalKey.Replace("skid.", $"skid.{skidId}.")
                    : canonicalKey;

                factRegistry.TryGetValue(mappedKey, out var fact);
                if (fact == null)
                {
                    factRegistry.TryGetValue(canonicalKey, out fact);
                }

                if (fact == null || fact.Status == FactStatus.Unknown || fact.Confidence == FactConfidence.RequiresConfirmation)
                {
                    return new EvalResult
                    {
                        Result = false,
                        NeedsInput = true,
                        Trace = $"Required fact '{(fact != null ? fact.Label : fKey)}' requires confirmation or is unknown ({(fact != null ? fact.Status.ToString() : "Missing")})"
                    };
                }
            }

            if (predicate == null)
            {
                return new EvalResult { Result = true, NeedsInput = false, Trace = "Standard check (Always applicable)" };
            }

            if (predicate.Count == 0)
                return NeedsInput("Unsupported or malformed predicate");

            return EvaluateElement(predicate, context, factRegistry);
        }

        private EvalResult EvaluateElement(
            Dictionary<string, JsonElement> predicate,
            Dictionary<string, object?> context,
            Dictionary<string, Fact> factRegistry)
        {
            if (predicate.TryGetValue(">=", out var gteElement) && gteElement.ValueKind == JsonValueKind.Array && gteElement.GetArrayLength() >= 2)
            {
                var left = ResolveValue(gteElement[0], context);
                var right = ResolveValue(gteElement[1], context);
                if (!TryToDouble(left, out var leftNum) || !TryToDouble(right, out var rightNum))
                    return NeedsInput("Numeric comparison requires numeric values");
                bool res = leftNum >= rightNum;
                return new EvalResult
                {
                    Result = res,
                    NeedsInput = false,
                    Trace = $"Evaluated: {leftNum} >= {rightNum} ({(res ? "True" : "False")})"
                };
            }

            if (predicate.TryGetValue("<=", out var lteElement) && lteElement.ValueKind == JsonValueKind.Array && lteElement.GetArrayLength() >= 2)
            {
                var left = ResolveValue(lteElement[0], context);
                var right = ResolveValue(lteElement[1], context);
                if (!TryToDouble(left, out var leftNum) || !TryToDouble(right, out var rightNum))
                    return NeedsInput("Numeric comparison requires numeric values");
                bool res = leftNum <= rightNum;
                return new EvalResult
                {
                    Result = res,
                    NeedsInput = false,
                    Trace = $"Evaluated: {leftNum} <= {rightNum} ({(res ? "True" : "False")})"
                };
            }

            if (predicate.TryGetValue(">", out var gtElement) && gtElement.ValueKind == JsonValueKind.Array && gtElement.GetArrayLength() >= 2)
            {
                var left = ResolveValue(gtElement[0], context);
                var right = ResolveValue(gtElement[1], context);
                if (!TryToDouble(left, out var leftNum) || !TryToDouble(right, out var rightNum))
                    return NeedsInput("Numeric comparison requires numeric values");
                bool res = leftNum > rightNum;
                return new EvalResult
                {
                    Result = res,
                    NeedsInput = false,
                    Trace = $"Evaluated: {leftNum} > {rightNum} ({(res ? "True" : "False")})"
                };
            }

            if (predicate.TryGetValue("<", out var ltElement) && ltElement.ValueKind == JsonValueKind.Array && ltElement.GetArrayLength() >= 2)
            {
                var left = ResolveValue(ltElement[0], context);
                var right = ResolveValue(ltElement[1], context);
                if (!TryToDouble(left, out var leftNum) || !TryToDouble(right, out var rightNum))
                    return NeedsInput("Numeric comparison requires numeric values");
                bool res = leftNum < rightNum;
                return new EvalResult
                {
                    Result = res,
                    NeedsInput = false,
                    Trace = $"Evaluated: {leftNum} < {rightNum} ({(res ? "True" : "False")})"
                };
            }

            if (predicate.TryGetValue("===", out var eqElement) && eqElement.ValueKind == JsonValueKind.Array && eqElement.GetArrayLength() >= 2)
            {
                var left = ResolveValue(eqElement[0], context);
                var right = ResolveValue(eqElement[1], context);
                if (left == null || right == null) return NeedsInput("Equality comparison requires known values");
                bool res = ValuesEqual(left, right);
                return new EvalResult
                {
                    Result = res,
                    NeedsInput = false,
                    Trace = $"Evaluated: {left} === {right} ({(res ? "True" : "False")})"
                };
            }

            if (predicate.TryGetValue("!==", out var neElement) && neElement.ValueKind == JsonValueKind.Array && neElement.GetArrayLength() >= 2)
            {
                var left = ResolveValue(neElement[0], context);
                var right = ResolveValue(neElement[1], context);
                if (left == null || right == null) return NeedsInput("Equality comparison requires known values");
                bool res = !ValuesEqual(left, right);
                return new EvalResult
                {
                    Result = res,
                    NeedsInput = false,
                    Trace = $"Evaluated: {left} !== {right} ({(res ? "True" : "False")})"
                };
            }

            if (predicate.TryGetValue("includes", out var incElement) && incElement.ValueKind == JsonValueKind.Array && incElement.GetArrayLength() >= 2)
            {
                var leftValue = ResolveValue(incElement[0], context);
                var rightValue = ResolveValue(incElement[1], context);
                if (leftValue == null || rightValue == null) return NeedsInput("Includes comparison requires known values");
                string leftStr = leftValue.ToString() ?? "";
                string rightStr = rightValue.ToString() ?? "";
                bool res = leftStr.Contains(rightStr, StringComparison.OrdinalIgnoreCase);
                return new EvalResult
                {
                    Result = res,
                    NeedsInput = false,
                    Trace = $"Evaluated: \"{leftStr}\" includes \"{rightStr}\" ({(res ? "True" : "False")})"
                };
            }

            if (predicate.TryGetValue("in", out var inElement) && inElement.ValueKind == JsonValueKind.Array && inElement.GetArrayLength() >= 2)
            {
                var left = ResolveValue(inElement[0], context);
                if (left == null) return NeedsInput("Membership comparison requires a known value");
                var right = inElement[1];
                bool res = false;
                if (right.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in right.EnumerateArray())
                    {
                        var itemVal = ResolveValue(item, context);
                        if (ValuesEqual(left, itemVal))
                        {
                            res = true;
                            break;
                        }
                    }
                }
                else
                {
                    var rightStr = (ResolveValue(right, context) ?? "").ToString() ?? "";
                    var items = rightStr.Split(',').Select(s => s.Trim()).Where(s => !string.IsNullOrEmpty(s));
                    res = items.Any(item => ValuesEqual(left, item));
                }
                return new EvalResult
                {
                    Result = res,
                    NeedsInput = false,
                    Trace = $"Evaluated: {left} in {right} ({(res ? "True" : "False")})"
                };
            }

            if (predicate.TryGetValue("and", out var andElement) && andElement.ValueKind == JsonValueKind.Array)
            {
                var traces = new List<string>();
                foreach (var sub in andElement.EnumerateArray())
                {
                    if (sub.ValueKind == JsonValueKind.Object)
                    {
                        var subDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(sub.GetRawText());
                        if (subDict != null)
                        {
                            var subEval = EvaluateElement(subDict, context, factRegistry);
                            if (subEval.NeedsInput)
                                return new EvalResult { Result = false, NeedsInput = true, Trace = subEval.Trace };
                            traces.Add(subEval.Trace);
                            if (!subEval.Result)
                                return new EvalResult { Result = false, NeedsInput = false, Trace = string.Join(" AND ", traces) };
                        }
                    }
                }
                return new EvalResult { Result = true, NeedsInput = false, Trace = string.Join(" AND ", traces) };
            }

            if (predicate.TryGetValue("or", out var orElement) && orElement.ValueKind == JsonValueKind.Array)
            {
                var traces = new List<string>();
                bool hasTrue = false;
                bool anyNeedsInput = false;
                string needsInputTrace = "";

                foreach (var sub in orElement.EnumerateArray())
                {
                    if (sub.ValueKind == JsonValueKind.Object)
                    {
                        var subDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(sub.GetRawText());
                        if (subDict != null)
                        {
                            var subEval = EvaluateElement(subDict, context, factRegistry);
                            if (subEval.NeedsInput)
                            {
                                anyNeedsInput = true;
                                needsInputTrace = subEval.Trace;
                            }
                            traces.Add(subEval.Trace);
                            if (subEval.Result)
                            {
                                hasTrue = true;
                                break;
                            }
                        }
                    }
                }

                if (hasTrue)
                {
                    return new EvalResult { Result = true, NeedsInput = false, Trace = string.Join(" OR ", traces) };
                }
                if (anyNeedsInput)
                {
                    return new EvalResult { Result = false, NeedsInput = true, Trace = needsInputTrace };
                }
                return new EvalResult { Result = false, NeedsInput = false, Trace = string.Join(" OR ", traces) };
            }

            return NeedsInput("Unsupported or malformed predicate");
        }

        private static EvalResult NeedsInput(string trace) => new EvalResult
        {
            Result = false,
            NeedsInput = true,
            Trace = trace
        };

        private static object? ResolveValue(JsonElement element, Dictionary<string, object?> context)
        {
            if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty("var", out var varProp))
            {
                string varName = FactContractValidator.CanonicalizeKey(varProp.GetString() ?? "");
                return context.TryGetValue(varName, out var v) ? v : null;
            }

            return element.ValueKind switch
            {
                JsonValueKind.String => element.GetString(),
                JsonValueKind.Number => element.TryGetInt64(out var i) ? i : element.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null,
                _ => element.ToString()
            };
        }

        private static bool ValuesEqual(object? left, object? right)
        {
            if (left == null && right == null) return true;
            if (left == null || right == null) return false;

            if (left is bool b1 && right is bool b2) return b1 == b2;
            if (left is bool || right is bool) return false;
            if (left is string || right is string)
                return left is string leftString && right is string rightString &&
                    string.Equals(leftString, rightString, StringComparison.OrdinalIgnoreCase);
            if (double.TryParse(left.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var d1) &&
                double.TryParse(right.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var d2))
            {
                return d1 == d2;
            }

            return string.Equals(left.ToString(), right.ToString(), StringComparison.OrdinalIgnoreCase);
        }

        private static bool TryToDouble(object? val, out double number)
        {
            number = 0;
            return val != null && double.TryParse(val.ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out number)
                && double.IsFinite(number);
        }

        public List<ChecklistInstance> GenerateChecklists(
            List<RuleDefinition> rules,
            NormalizedXmlGraph graph,
            Dictionary<string, Fact> factRegistry,
            List<ChecklistInstance>? existingInstances = null)
        {
            var existingMap = new Dictionary<string, ChecklistInstance>();
            if (existingInstances != null)
            {
                foreach (var inst in existingInstances)
                {
                    existingMap[inst.InstanceKey] = inst;
                }
            }

            var instances = new List<ChecklistInstance>();

            var unitContext = new Dictionary<string, object?>();
            foreach (var kv in factRegistry)
            {
                unitContext[kv.Key] = kv.Value.Value;
            }


            foreach (var rule in rules.Where(r => r.IsArchived != true))
            {
                string fingerprint = ComputeSemanticFingerprint(rule);
                if (rule.Scope == RuleScope.Unit)
                {
                    string instanceKey = $"unit:{rule.Id}";
                    existingMap.TryGetValue(instanceKey, out var existing);

                    var eval = EvaluatePredicate(rule.Predicate, unitContext, rule.RequiredFacts, factRegistry);
                    var applicability = eval.NeedsInput ? RuleApplicability.NeedsInput : (eval.Result ? RuleApplicability.Applicable : RuleApplicability.NotApplicable);

                    var traces = rule.RequiredFacts.Select(k => new FactTrace
                    {
                        Key = k,
                        Label = factRegistry.TryGetValue(k, out var f) ? f.Label : k,
                        Value = factRegistry.TryGetValue(k, out var f2) ? f2.Value : null,
                        Status = factRegistry.TryGetValue(k, out var f3) ? f3.Status : FactStatus.Unknown
                    }).ToList();

                    instances.Add(new ChecklistInstance
                    {
                        RuleId = rule.Id,
                        SemanticKey = rule.SemanticKey,
                        InstanceKey = instanceKey,
                        ScopeTargetId = "unit",
                        Applicability = applicability,
                        ApplicabilityReason = eval.Trace,
                        Status = ResolveStatus(existing, applicability, fingerprint),
                        DetailerComment = existing?.DetailerComment ?? "",
                        DetailerInitials = existing?.DetailerInitials,
                        CheckerComment = existing?.CheckerComment,
                        CheckerInitials = existing?.CheckerInitials,
                        UpdatedAt = existing?.UpdatedAt ?? DateTime.UtcNow.ToString("o"),
                        FactTraces = traces,
                        SemanticFingerprint = fingerprint
                    });
                }
                else if (rule.Scope == RuleScope.Skid)
                {
                    foreach (var skid in graph.Skids)
                    {
                        string instanceKey = $"{skid.Id}:{rule.Id}";
                        existingMap.TryGetValue(instanceKey, out var existing);

                        var skidContext = new Dictionary<string, object?>(unitContext)
                        {
                            ["__skidId"] = skid.Id,
                            ["skid.hasSplit"] = factRegistry.TryGetValue($"skid.{skid.Id}.hasSplit", out var fhs) ? fhs.Value : (graph.Skids.Count > 1),
                            // CalculatedWeight is diagnostic only. A missing
                            // authored/approved weight stays null and is
                            // surfaced as NeedsInput by required-fact checks.
                            ["skid.weight"] = factRegistry.TryGetValue($"skid.{skid.Id}.weight", out var fw) ? fw.Value : null,
                            ["skid.segmentCount"] = factRegistry.TryGetValue($"skid.{skid.Id}.segmentCount", out var fsc) ? fsc.Value : skid.SegmentIds.Count,
                            ["skid.hasDrainPan"] = factRegistry.TryGetValue($"skid.{skid.Id}.hasDrainPan", out var fdp) ? fdp.Value : false,
                            ["skid.hasFans"] = factRegistry.TryGetValue($"skid.{skid.Id}.hasFans", out var ff) ? ff.Value : false,
                            ["skid.hasCoils"] = factRegistry.TryGetValue($"skid.{skid.Id}.hasCoils", out var fc) ? fc.Value : false,
                            ["skid.hasFilters"] = factRegistry.TryGetValue($"skid.{skid.Id}.hasFilters", out var ffl) ? ffl.Value : false,
                            ["skid.hasHeatWheel"] = factRegistry.TryGetValue($"skid.{skid.Id}.hasHeatWheel", out var fhw) ? fhw.Value : false
                        };

                        var eval = EvaluatePredicate(rule.Predicate, skidContext, rule.RequiredFacts, factRegistry);
                        var applicability = eval.NeedsInput ? RuleApplicability.NeedsInput : (eval.Result ? RuleApplicability.Applicable : RuleApplicability.NotApplicable);

                        var traces = rule.RequiredFacts.Select(k =>
                        {
                            string mappedKey = k.StartsWith("skid.") ? k.Replace("skid.", $"skid.{skid.Id}.") : k;
                            factRegistry.TryGetValue(mappedKey, out var f);
                            if (f == null) factRegistry.TryGetValue(k, out f);

                            return new FactTrace
                            {
                                Key = mappedKey,
                                Label = f?.Label ?? k,
                                Value = skidContext.TryGetValue(k, out var scVal) ? scVal : f?.Value,
                                Status = f?.Status ?? FactStatus.Unknown
                            };
                        }).ToList();

                        instances.Add(new ChecklistInstance
                        {
                            RuleId = rule.Id,
                            SemanticKey = rule.SemanticKey,
                            InstanceKey = instanceKey,
                            ScopeTargetId = skid.Id,
                            Applicability = applicability,
                            ApplicabilityReason = eval.Trace,
                            Status = ResolveStatus(existing, applicability, fingerprint),
                            DetailerComment = existing?.DetailerComment ?? "",
                            DetailerInitials = existing?.DetailerInitials,
                            CheckerComment = existing?.CheckerComment,
                            CheckerInitials = existing?.CheckerInitials,
                            UpdatedAt = existing?.UpdatedAt ?? DateTime.UtcNow.ToString("o"),
                            FactTraces = traces,
                            SemanticFingerprint = fingerprint
                        });
                    }
                }
            }

            return instances;
        }

        private static CheckStatus ResolveStatus(ChecklistInstance? existing, RuleApplicability applicability, string fingerprint)
        {
            if (applicability == RuleApplicability.NotApplicable) return CheckStatus.NA;
            if (applicability == RuleApplicability.NeedsInput) return CheckStatus.Incomplete;
            return existing != null && existing.Applicability == RuleApplicability.Applicable &&
                string.Equals(existing.SemanticFingerprint, fingerprint, StringComparison.Ordinal)
                ? existing.Status
                : CheckStatus.Incomplete;
        }

        // Stable contract shared with the TypeScript preview engine:
        // recursively sort object keys, preserve array order, canonicalize
        // fact aliases, sort required facts, and return the canonical JSON
        // text (not a runtime-specific hash).
        public static string ComputeSemanticFingerprint(RuleDefinition rule)
        {
            string predicateJson = "null";
            if (rule.Predicate != null)
            {
                string raw = JsonSerializer.Serialize(FactContractValidator.NormalizePredicate(rule.Predicate));
                using var document = JsonDocument.Parse(raw);
                predicateJson = StableJson(document.RootElement);
            }

            string requiredFacts = JsonSerializer.Serialize(rule.RequiredFacts
                .Select(FactContractValidator.CanonicalizeKey)
                .OrderBy(k => k, StringComparer.Ordinal)
                .ToList(), CanonicalJsonOptions);
            return "{" +
                "\"allowNA\":" + (rule.AllowNA ? "true" : "false") + "," +
                "\"instructions\":" + DvlProjectManager.CanonicalizeJsonString(rule.Text) + "," +
                "\"predicate\":" + predicateJson + "," +
                "\"requiredFacts\":" + requiredFacts + "," +
                "\"scope\":" + DvlProjectManager.CanonicalizeJsonString(rule.Scope.ToString()) + "," +
                "\"verificationMode\":" + DvlProjectManager.CanonicalizeJsonString(rule.VerificationMode) +
                "}";
        }

        private static string StableJson(JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    return "{" + string.Join(",", element.EnumerateObject()
                        .OrderBy(property => property.Name, StringComparer.Ordinal)
                        .Select(property => DvlProjectManager.CanonicalizeJsonString(property.Name) + ":" + StableJson(property.Value))) + "}";
                case JsonValueKind.Array:
                    return "[" + string.Join(",", element.EnumerateArray().Select(StableJson)) + "]";
                case JsonValueKind.String:
                    return DvlProjectManager.CanonicalizeJsonString(element.GetString());
                case JsonValueKind.Number:
                    return DvlProjectManager.CanonicalizeJsonNumber(element);
                case JsonValueKind.True: return "true";
                case JsonValueKind.False: return "false";
                default: return "null";
            }
        }
    }
}
