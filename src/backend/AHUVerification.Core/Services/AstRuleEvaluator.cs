using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Services
{
    public class AstRuleEvaluator
    {
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
            if (predicate == null || predicate.Count == 0)
            {
                return new EvalResult { Result = true, NeedsInput = false, Trace = "Standard check (Always applicable)" };
            }

            // Check if any required fact is Unknown or RequiresConfirmation
            string? skidId = context.TryGetValue("__skidId", out var sObj) ? sObj?.ToString() : null;
            foreach (var fKey in requiredFacts)
            {
                string mappedKey = fKey.StartsWith("skid.") && skidId != null
                    ? fKey.Replace("skid.", $"skid.{skidId}.")
                    : fKey;

                factRegistry.TryGetValue(mappedKey, out var fact);
                if (fact == null)
                {
                    factRegistry.TryGetValue(fKey, out fact);
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
                double leftNum = ToDouble(left);
                double rightNum = ToDouble(right);
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
                double leftNum = ToDouble(left);
                double rightNum = ToDouble(right);
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
                double leftNum = ToDouble(left);
                double rightNum = ToDouble(right);
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
                double leftNum = ToDouble(left);
                double rightNum = ToDouble(right);
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
                string leftStr = (ResolveValue(incElement[0], context) ?? "").ToString() ?? "";
                string rightStr = (ResolveValue(incElement[1], context) ?? "").ToString() ?? "";
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

            return new EvalResult { Result = true, NeedsInput = false, Trace = "Default true" };
        }

        private static object? ResolveValue(JsonElement element, Dictionary<string, object?> context)
        {
            if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty("var", out var varProp))
            {
                string varName = varProp.GetString() ?? "";
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
            if (double.TryParse(left.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var d1) &&
                double.TryParse(right.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var d2))
            {
                return Math.Abs(d1 - d2) < 0.0001;
            }

            return string.Equals(left.ToString(), right.ToString(), StringComparison.OrdinalIgnoreCase);
        }

        private static double ToDouble(object? val)
        {
            if (val == null) return 0;
            return double.TryParse(val.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0;
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
                        Status = existing?.Status ?? (applicability == RuleApplicability.NotApplicable ? CheckStatus.NA : CheckStatus.Incomplete),
                        DetailerComment = existing?.DetailerComment ?? "",
                        CheckerComment = existing?.CheckerComment,
                        UpdatedAt = existing?.UpdatedAt ?? DateTime.UtcNow.ToString("o"),
                        FactTraces = traces
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
                            ["skid.weight"] = factRegistry.TryGetValue($"skid.{skid.Id}.weight", out var fw) ? fw.Value : skid.CalculatedWeight,
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
                            Status = existing?.Status ?? (applicability == RuleApplicability.NotApplicable ? CheckStatus.NA : CheckStatus.Incomplete),
                            DetailerComment = existing?.DetailerComment ?? "",
                            CheckerComment = existing?.CheckerComment,
                            UpdatedAt = existing?.UpdatedAt ?? DateTime.UtcNow.ToString("o"),
                            FactTraces = traces
                        });
                    }
                }
            }

            return instances;
        }
    }
}
