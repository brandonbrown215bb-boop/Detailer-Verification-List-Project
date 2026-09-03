using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace AHUVerification.Core.Bridge
{
    public class BridgeRequest
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("action")]
        public string Action { get; set; } = "";

        [JsonPropertyName("payload")]
        public JsonElement Payload { get; set; }

        /// <summary>
        /// Resiliently extracts the request "id" from raw JSON string, even when the JSON is malformed or partial.
        /// </summary>
        public static string ExtractRequestId(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return "";

            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind == JsonValueKind.Object)
                {
                    if (doc.RootElement.TryGetProperty("id", out var idProp) && idProp.ValueKind == JsonValueKind.String)
                        return idProp.GetString() ?? "";
                    if (doc.RootElement.TryGetProperty("Id", out var idPropUpper) && idPropUpper.ValueKind == JsonValueKind.String)
                        return idPropUpper.GetString() ?? "";
                }
            }
            catch
            {
                // Fall back to regex pattern match for malformed or truncated JSON
                var match = Regex.Match(json, "\"id\"\\s*:\\s*\"([^\"]+)\"", RegexOptions.IgnoreCase);
                if (match.Success && match.Groups.Count > 1)
                {
                    return match.Groups[1].Value;
                }
            }

            return "";
        }
    }

    public class BridgeResponse
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("data")]
        public object? Data { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }

        public static BridgeResponse Ok(string id, object? data = null) =>
            new() { Id = id, Success = true, Data = data };

        public static BridgeResponse Fail(string id, string error) =>
            new() { Id = id, Success = false, Error = error };
    }

    public static class BridgeValidation
    {
        public static void EnsureObjectPayload(JsonElement payload, string action)
        {
            if (payload.ValueKind != JsonValueKind.Object)
            {
                throw new ArgumentException($"Action '{action}' requires a JSON object payload.");
            }
        }

        public static string RequireStringProperty(JsonElement payload, string action, string propertyName)
        {
            EnsureObjectPayload(payload, action);

            if (!payload.TryGetProperty(propertyName, out var prop) ||
                prop.ValueKind != JsonValueKind.String ||
                string.IsNullOrWhiteSpace(prop.GetString()))
            {
                throw new ArgumentException($"Action '{action}' requires a non-empty string property '{propertyName}'.");
            }

            return prop.GetString()!;
        }

        public static string GetStringPropertyOrDefault(JsonElement payload, string propertyName, string defaultValue = "")
        {
            if (payload.ValueKind == JsonValueKind.Object &&
                payload.TryGetProperty(propertyName, out var prop) &&
                prop.ValueKind == JsonValueKind.String)
            {
                return prop.GetString() ?? defaultValue;
            }

            return defaultValue;
        }

        public static JsonElement RequireObjectProperty(JsonElement payload, string action, string propertyName)
        {
            EnsureObjectPayload(payload, action);

            if (!payload.TryGetProperty(propertyName, out var prop) ||
                prop.ValueKind != JsonValueKind.Object)
            {
                throw new ArgumentException($"Action '{action}' requires an object property '{propertyName}'.");
            }

            return prop;
        }

        public static JsonElement RequireArrayProperty(JsonElement payload, string action, string propertyName)
        {
            EnsureObjectPayload(payload, action);

            if (!payload.TryGetProperty(propertyName, out var prop) ||
                prop.ValueKind != JsonValueKind.Array)
            {
                throw new ArgumentException($"Action '{action}' requires an array property '{propertyName}'.");
            }

            return prop;
        }

        public static bool GetBooleanPropertyOrDefault(JsonElement payload, string propertyName, bool defaultValue = false)
        {
            if (payload.ValueKind == JsonValueKind.Object &&
                payload.TryGetProperty(propertyName, out var prop))
            {
                if (prop.ValueKind == JsonValueKind.True) return true;
                if (prop.ValueKind == JsonValueKind.False) return false;
            }

            return defaultValue;
        }
    }
}

