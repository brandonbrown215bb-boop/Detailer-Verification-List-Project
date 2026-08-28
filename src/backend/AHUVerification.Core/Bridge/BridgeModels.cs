using System.Text.Json;
using System.Text.Json.Serialization;

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
}

