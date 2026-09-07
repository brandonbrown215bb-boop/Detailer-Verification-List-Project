using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Services
{
    /// <summary>
    /// Small, data-driven validator for the versioned fact/rule contract shipped in a rule pack.
    /// The browser build has the equivalent implementation in factContract.ts.
    /// </summary>
    public static class FactContractValidator
    {
        private sealed record FactSpec(string Key, string Type, string Scope);

        // The certified evaluator currently materializes Unit and Skid
        // instances.  Segment/Component rules remain editor data until their
        // instance topology is implemented end-to-end.
        private static readonly HashSet<string> SupportedScopes = new(StringComparer.Ordinal)
            { "Unit", "Skid" };
        private static readonly HashSet<string> SupportedModes = new(StringComparer.Ordinal)
            { "ManualCheckbox" };
        private static readonly HashSet<string> SupportedCategories = new(StringComparer.Ordinal)
            { "Base", "Housing", "Knockdown", "UTL", "Paperwork", "MOM", "Internals" };
        private static readonly HashSet<string> LeafOperators = new(StringComparer.Ordinal)
            { ">=", "<=", ">", "<", "===", "!==", "includes", "in" };

        private static readonly Dictionary<string, string> BuiltInAliases = new(StringComparer.Ordinal)
        {
            ["unit.wallThickness"] = "casing.thicknessFront",
            ["unit.roofPeak"] = "roof.roofPeak",
            ["unit.location"] = "unit.unitType",
            ["unit.utl"] = "unit.hasUTL",
            ["unit.linerMaterial"] = "casing.interiorMaterial",
            ["unit.linerGauge"] = "casing.interiorGauge",
            ["unit.skinMaterial"] = "casing.exteriorMaterial",
            ["unit.skinGauge"] = "casing.exteriorGauge",
            ["unit.floorMaterial"] = "casing.floorMaterial",
            ["unit.floorGauge"] = "casing.floorGauge",
            ["unit.casingMaterial"] = "casing.exteriorMaterial"
        };

        private static string Canonicalize(string key, Dictionary<string, string> aliases)
        {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            string current = key;
            while (aliases.TryGetValue(current, out var replacement) && seen.Add(current)) current = replacement;
            return current;
        }

        public static string CanonicalizeKey(string key)
        {
            return BuiltInAliases.TryGetValue(key, out var canonical) ? canonical : key;
        }

        public static string CanonicalizeKey(string key, JsonElement contract)
        {
            var aliases = ReadAliases(contract);
            return Canonicalize(key, aliases);
        }

        private static Dictionary<string, string> ReadAliases(JsonElement contract)
        {
            var aliases = new Dictionary<string, string>(BuiltInAliases, StringComparer.Ordinal);
            if (contract.ValueKind == JsonValueKind.Object
                && contract.TryGetProperty("legacyAliases", out var aliasElement)
                && aliasElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in aliasElement.EnumerateObject())
                {
                    if (property.Value.ValueKind == JsonValueKind.String
                        && !string.IsNullOrWhiteSpace(property.Value.GetString()))
                        aliases[property.Name] = property.Value.GetString()!;
                }
            }
            return aliases;
        }

        public static bool TryGetFactType(JsonElement contract, string rawKey, out string type)
        {
            type = "";
            var specs = new List<FactSpec>();
            ReadSpecs(contract, "facts", specs);
            ReadSpecs(contract, "patterns", specs);
            var aliases = ReadAliases(contract);

            if (!TryGetSpec(rawKey, specs, aliases, out var spec) || spec == null) return false;
            type = spec.Type;
            return true;
        }

        public static bool IsFactValueCompatible(JsonElement contract, string rawKey, object? value)
        {
            if (!TryGetFactType(contract, rawKey, out var type) || value == null) return false;
            if (value is JsonElement json)
            {
                return type switch
                {
                    "string" => json.ValueKind == JsonValueKind.String,
                    "number" => json.ValueKind == JsonValueKind.Number && json.TryGetDouble(out var d) && double.IsFinite(d),
                    "boolean" => json.ValueKind is JsonValueKind.True or JsonValueKind.False,
                    _ => false
                };
            }
            return type switch
            {
                "string" => value is string,
                "number" => value is IConvertible && double.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture, out var d) && double.IsFinite(d),
                "boolean" => value is bool,
                _ => false
            };
        }

        public static void Validate(JsonElement contract, JsonElement rules, JsonElement templateMap)
        {
            var errors = GetValidationErrors(contract, rules, templateMap);
            if (errors.Count > 0) throw new InvalidOperationException("Rule pack validation failed:\n" + string.Join("\n", errors));
        }

        public static List<string> GetValidationErrors(JsonElement contract, JsonElement rules, JsonElement templateMap)
        {
            if (contract.ValueKind != JsonValueKind.Object)
                return new List<string> { "Rule pack fact_contract.json must be a JSON object." };

            string version = OptionalString(contract, "contractVersion") ?? "";
            if (string.IsNullOrWhiteSpace(version)) return new List<string> { "Fact contract version is empty." };

            var aliases = new Dictionary<string, string>(BuiltInAliases, StringComparer.Ordinal);
            if (contract.TryGetProperty("legacyAliases", out var aliasElement))
            {
                if (aliasElement.ValueKind != JsonValueKind.Object) return new List<string> { "fact_contract.legacyAliases must be an object." };
                foreach (var property in aliasElement.EnumerateObject())
                {
                    if (property.Value.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(property.Value.GetString()))
                        return new List<string> { $"fact_contract.legacyAliases.{property.Name} must map to a non-empty string." };
                    aliases[property.Name] = property.Value.GetString()!;
                }
            }

            var specs = new List<FactSpec>();
            try
            {
                ReadSpecs(contract, "facts", specs);
                ReadSpecs(contract, "patterns", specs);
            }
            catch (Exception ex)
            {
                return new List<string> { ex.Message };
            }

            if (specs.Count == 0) return new List<string> { "fact_contract must declare facts or patterns." };

            var errors = new List<string>();
            if (rules.ValueKind != JsonValueKind.Array || rules.GetArrayLength() == 0) errors.Add("rules.json must be a non-empty array.");
            var ids = new HashSet<string>(StringComparer.Ordinal);
            var semanticKeys = new HashSet<string>(StringComparer.Ordinal);
            if (rules.ValueKind == JsonValueKind.Array)
            {
                int index = 0;
                foreach (var rule in rules.EnumerateArray())
                {
                    if (rule.ValueKind != JsonValueKind.Object) { errors.Add($"rules[{index}] must be an object."); index++; continue; }
                    string id = OptionalString(rule, "id") ?? "";
                    string semanticKey = OptionalString(rule, "semanticKey") ?? "";
                    if (string.IsNullOrWhiteSpace(id) || !ids.Add(id)) errors.Add($"rules[{index}] has duplicate or missing id '{id}'.");
                    if (string.IsNullOrWhiteSpace(semanticKey) || !semanticKeys.Add(semanticKey)) errors.Add($"rules[{index}] has duplicate or missing semanticKey '{semanticKey}'.");
                    string scope = OptionalString(rule, "scope") ?? "";
                    if (!SupportedScopes.Contains(scope)) errors.Add($"rules[{index}] has unsupported scope '{scope}'.");
                    string mode = OptionalString(rule, "verificationMode") ?? "";
                    if (!SupportedModes.Contains(mode)) errors.Add($"rules[{index}] has unsupported verificationMode '{mode}'.");
                    string category = OptionalString(rule, "category") ?? "";
                    if (!SupportedCategories.Contains(category)) errors.Add($"rules[{index}] has unsupported category '{category}'.");

                    if (rule.TryGetProperty("requiredFacts", out var required) && required.ValueKind == JsonValueKind.Array)
                    {
                        int factIndex = 0;
                        foreach (var item in required.EnumerateArray())
                        {
                            if (item.ValueKind != JsonValueKind.String || !TryGetSpec(item.GetString() ?? "", specs, aliases, out _))
                                errors.Add($"rules[{index}].requiredFacts[{factIndex}] references an unknown fact.");
                            factIndex++;
                        }
                    }
                    else errors.Add($"rules[{index}].requiredFacts must be an array.");

                    if (rule.TryGetProperty("predicate", out var predicate) && predicate.ValueKind != JsonValueKind.Null)
                        ValidatePredicate(predicate, $"rules[{index}].predicate", specs, aliases, errors);
                    index++;
                }
            }

            ValidateTemplateMap(templateMap, semanticKeys, specs, aliases, errors);
            return errors;
        }

        public static Dictionary<string, JsonElement>? NormalizePredicate(Dictionary<string, JsonElement>? predicate)
            => NormalizePredicate(predicate, default);

        public static Dictionary<string, JsonElement>? NormalizePredicate(Dictionary<string, JsonElement>? predicate, JsonElement contract)
        {
            if (predicate == null) return null;
            var result = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
            foreach (var pair in predicate)
            {
                if (pair.Key == "var" && pair.Value.ValueKind == JsonValueKind.String)
                {
                    result[pair.Key] = ParseJsonElement(JsonSerializer.Serialize(CanonicalizeKey(pair.Value.GetString() ?? "", contract)));
                }
                else if (pair.Value.ValueKind == JsonValueKind.Array)
                {
                    var values = pair.Value.EnumerateArray().Select(item => NormalizeElement(item, contract)).ToArray();
                    result[pair.Key] = ParseJsonElement(JsonSerializer.Serialize(values));
                }
                else result[pair.Key] = NormalizeElement(pair.Value, contract);
            }
            return result;
        }

        private static JsonElement NormalizeElement(JsonElement element, JsonElement contract = default)
        {
            if (element.ValueKind == JsonValueKind.Object)
            {
                if (element.TryGetProperty("var", out var variable) && variable.ValueKind == JsonValueKind.String && element.EnumerateObject().Count() == 1)
                    return ParseJsonElement(JsonSerializer.Serialize(new Dictionary<string, string> { ["var"] = CanonicalizeKey(variable.GetString() ?? "", contract) }));
                var obj = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
                foreach (var property in element.EnumerateObject()) obj[property.Name] = NormalizeElement(property.Value, contract);
                return ParseJsonElement(JsonSerializer.Serialize(obj));
            }
            if (element.ValueKind == JsonValueKind.Array)
            {
                var values = element.EnumerateArray().Select(item => NormalizeElement(item, contract)).ToArray();
                return ParseJsonElement(JsonSerializer.Serialize(values));
            }
            return element.Clone();
        }

        private static JsonElement ParseJsonElement(string json)
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }

        private static void ReadSpecs(JsonElement contract, string propertyName, List<FactSpec> specs)
        {
            if (!contract.TryGetProperty(propertyName, out var values) || values.ValueKind != JsonValueKind.Array)
                throw new InvalidOperationException($"fact_contract.{propertyName} must be an array.");
            foreach (var item in values.EnumerateArray())
            {
                string key = RequiredString(item, "key", $"fact_contract.{propertyName}");
                string type = RequiredString(item, "type", $"fact_contract.{propertyName}.{key}");
                string scope = RequiredString(item, "scope", $"fact_contract.{propertyName}.{key}");
                if (!new[] { "string", "number", "boolean" }.Contains(type, StringComparer.Ordinal)) throw new InvalidOperationException($"Unsupported fact type '{type}' for '{key}'.");
                if (!new[] { "Unit", "Skid", "Base", "Segment", "Component", "Opening" }.Contains(scope, StringComparer.Ordinal)) throw new InvalidOperationException($"Unsupported fact scope '{scope}' for '{key}'.");
                if (specs.Any(existing => existing.Key == key)) throw new InvalidOperationException($"Duplicate fact contract key '{key}'.");
                specs.Add(new FactSpec(key, type, scope));
            }
        }

        private static bool TryGetSpec(string rawKey, List<FactSpec> specs, Dictionary<string, string> aliases, out FactSpec? spec)
        {
            string key = Canonicalize(rawKey, aliases);
            spec = specs.FirstOrDefault(candidate => candidate.Key == key);
            if (spec != null) return true;
            foreach (var candidate in specs.Where(candidate => candidate.Key.Contains("{id}", StringComparison.Ordinal)))
            {
                string pattern = "^" + string.Join(@"\.", candidate.Key.Split('.').Select(part => part == "{id}" ? "[^.]+" : Regex.Escape(part))) + "$";
                if (Regex.IsMatch(key, pattern, RegexOptions.CultureInvariant)) { spec = candidate; return true; }
            }
            return false;
        }

        private static void ValidatePredicate(JsonElement predicate, string path, List<FactSpec> specs, Dictionary<string, string> aliases, List<string> errors)
        {
            if (predicate.ValueKind != JsonValueKind.Object || predicate.EnumerateObject().Count() != 1) { errors.Add($"{path} must contain exactly one supported operator."); return; }
            var property = predicate.EnumerateObject().Single();
            string op = property.Name;
            if (LeafOperators.Contains(op))
            {
                if (property.Value.ValueKind != JsonValueKind.Array || property.Value.GetArrayLength() != 2) { errors.Add($"{path}.{op} must contain exactly two operands."); return; }
                var operands = property.Value.EnumerateArray().ToArray();
                string? leftType = TermType(operands[0], $"{path}.{op}[0]", specs, aliases, errors);
                string? rightType = op == "in" && operands[1].ValueKind == JsonValueKind.Array
                    ? (operands[1].GetArrayLength() == 0 ? null : TermType(operands[1][0], $"{path}.in[1][0]", specs, aliases, errors))
                    : TermType(operands[1], $"{path}.{op}[1]", specs, aliases, errors);
                if ((op is "<" or ">" or "<=" or ">=") && (leftType != "number" || rightType != "number")) errors.Add($"{path}.{op} operands must be numbers.");
                if (op == "includes" && (leftType != "string" || rightType != "string")) errors.Add($"{path}.includes operands must be strings.");
                if (op is "===" or "!==" && leftType != null && rightType != null && leftType != "null" && rightType != "null" && leftType != rightType) errors.Add($"{path}.{op} operands have incompatible types.");
                if (op == "in")
                {
                    if (operands[1].ValueKind != JsonValueKind.Array && rightType != "string") errors.Add($"{path}.in right operand must be an array or string.");
                    if (operands[1].ValueKind == JsonValueKind.Array)
                    {
                        int index = 0;
                        foreach (var item in operands[1].EnumerateArray())
                        {
                            string? itemType = TermType(item, $"{path}.in[1][{index}]", specs, aliases, errors);
                            if (leftType != null && itemType != null && itemType != "null" && leftType != itemType) errors.Add($"{path}.in item {index} has incompatible type.");
                            index++;
                        }
                    }
                }
                return;
            }
            if (op is "and" or "or")
            {
                if (property.Value.ValueKind != JsonValueKind.Array || property.Value.GetArrayLength() == 0) { errors.Add($"{path}.{op} must be a non-empty array."); return; }
                int index = 0;
                foreach (var child in property.Value.EnumerateArray()) { ValidatePredicate(child, $"{path}.{op}[{index}]", specs, aliases, errors); index++; }
                return;
            }
            errors.Add($"{path} uses unsupported AST operator '{op}'.");
        }

        private static string? TermType(JsonElement term, string path, List<FactSpec> specs, Dictionary<string, string> aliases, List<string> errors)
        {
            if (term.ValueKind == JsonValueKind.Object && term.TryGetProperty("var", out var variable) && variable.ValueKind == JsonValueKind.String && term.EnumerateObject().Count() == 1)
            {
                if (TryGetSpec(variable.GetString() ?? "", specs, aliases, out var spec)) return spec!.Type;
                errors.Add($"{path} references unknown fact '{variable.GetString()}'.");
                return null;
            }
            return term.ValueKind switch
            {
                JsonValueKind.String => "string",
                JsonValueKind.Number when term.TryGetDouble(out _) => "number",
                JsonValueKind.True or JsonValueKind.False => "boolean",
                JsonValueKind.Null => "null",
                _ => AddMalformed(errors, path)
            };
        }

        private static string? AddMalformed(List<string> errors, string path) { errors.Add($"{path} is not a scalar literal or variable."); return null; }

        private static void ValidateTemplateMap(JsonElement map, HashSet<string> semanticKeys, List<FactSpec> specs, Dictionary<string, string> aliases, List<string> errors)
        {
            if (map.ValueKind != JsonValueKind.Object) { errors.Add("template_map.json must be an object."); return; }
            if (!map.TryGetProperty("templateVersion", out var version) || version.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(version.GetString())) errors.Add("template_map.templateVersion is required.");
            if (!map.TryGetProperty("generalFields", out var fields) || fields.ValueKind != JsonValueKind.Object) errors.Add("template_map.generalFields is required.");
            else foreach (var field in fields.EnumerateObject())
                {
                    if (field.Name != "generalComments" && !TryGetSpec(field.Name, specs, aliases, out _)) errors.Add($"template_map.generalFields references unknown fact '{field.Name}'.");
                    ValidateCoordinate(field.Value, $"template_map.generalFields.{field.Name}", errors);
                }
            if (!map.TryGetProperty("sqRange", out var range) || range.ValueKind != JsonValueKind.Object) errors.Add("template_map.sqRange is required.");
            else
            {
                int start = range.TryGetProperty("startRow", out var s) && s.TryGetInt32(out var si) ? si : 0;
                int end = range.TryGetProperty("endRow", out var e) && e.TryGetInt32(out var ei) ? ei : 0;
                if (start < 1 || end < start || !range.TryGetProperty("sheet", out var sheet) || sheet.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(sheet.GetString())) errors.Add("template_map.sqRange is malformed.");
            }
            if (!map.TryGetProperty("ruleCellMappings", out var mappings) || mappings.ValueKind != JsonValueKind.Object) { errors.Add("template_map.ruleCellMappings is required."); return; }
            foreach (var mapping in mappings.EnumerateObject())
            {
                if (!semanticKeys.Contains(mapping.Name)) errors.Add($"template_map.ruleCellMappings has orphan semantic key '{mapping.Name}'.");
                ValidateRuleMapping(mapping.Value, $"template_map.ruleCellMappings.{mapping.Name}", errors);
                if (!mapping.Value.TryGetProperty("ruleId", out var ruleId) || ruleId.ValueKind != JsonValueKind.String) errors.Add($"template_map.ruleCellMappings.{mapping.Name}.ruleId is required.");
            }
            foreach (string key in semanticKeys) if (!mappings.TryGetProperty(key, out _)) errors.Add($"template_map.ruleCellMappings is missing '{key}'.");
        }

        private static void ValidateCoordinate(JsonElement value, string path, List<string> errors)
        {
            if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty("sheet", out var sheet) || sheet.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(sheet.GetString()) || !value.TryGetProperty("cell", out var cell) || cell.ValueKind != JsonValueKind.String || !Regex.IsMatch(cell.GetString() ?? "", "^[A-Z]{1,3}[1-9][0-9]*$", RegexOptions.CultureInvariant)) errors.Add($"{path} is malformed.");
        }

        private static void ValidateRuleMapping(JsonElement value, string path, List<string> errors)
        {
            if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty("row", out var row) || !row.TryGetInt32(out var rowValue) || rowValue < 1)
            {
                errors.Add($"{path} is malformed.");
                return;
            }
            foreach (string property in new[] { "naCell", "detailerCell", "checkerCell", "commentsCell", "initialsCell" })
            {
                if (!value.TryGetProperty(property, out var cell) || cell.ValueKind != JsonValueKind.String || !Regex.IsMatch(cell.GetString() ?? "", "^[A-Z]{1,3}[1-9][0-9]*$", RegexOptions.CultureInvariant)) errors.Add($"{path}.{property} is malformed.");
            }
        }

        private static string RequiredString(JsonElement objectElement, string propertyName, string path)
        {
            if (!objectElement.TryGetProperty(propertyName, out var value) || value.ValueKind != JsonValueKind.String) throw new InvalidOperationException($"{path}.{propertyName} must be a string.");
            return value.GetString() ?? "";
        }

        private static string? OptionalString(JsonElement objectElement, string propertyName)
        {
            return objectElement.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
        }
    }
}
