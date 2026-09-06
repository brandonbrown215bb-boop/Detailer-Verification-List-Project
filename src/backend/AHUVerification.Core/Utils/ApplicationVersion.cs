using System;
using System.IO;
using System.Text.Json;

namespace AHUVerification.Core.Utils
{
    /// <summary>
    /// Reads the small, checked-in version.json file shipped beside each host.
    /// Rule Pack and source-document schema identities remain separate values.
    /// </summary>
    public static class ApplicationVersion
    {
        private const string FallbackApplicationVersion = "1.0.0";
        private const string FallbackDvlFormatVersion = "1.0";
        private const string FallbackDocumentSchemaVersion = "2018.9.14.1003";

        private static readonly Lazy<Metadata> CurrentMetadata = new(LoadMetadata);

        public static string Current => CurrentMetadata.Value.Version;
        public static string DvlFormat => CurrentMetadata.Value.DvlFormatVersion;
        public static string DocumentSchema => CurrentMetadata.Value.DocumentSchemaVersion;

        private static Metadata LoadMetadata()
        {
            string? path = FindMetadataPath();
            if (path == null)
                return Metadata.Fallback();

            try
            {
                var metadata = JsonSerializer.Deserialize<Metadata>(
                    File.ReadAllText(path),
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (metadata != null && !string.IsNullOrWhiteSpace(metadata.Version))
                    return metadata;
            }
            catch (JsonException)
            {
                // Preserve a usable host identity if an incomplete package is inspected.
            }
            catch (IOException)
            {
                // The packaged app can still report its fallback identity if the file is locked.
            }

            return Metadata.Fallback();
        }

        private static string? FindMetadataPath()
        {
            string? directory = AppContext.BaseDirectory;
            for (int depth = 0; depth < 8 && !string.IsNullOrEmpty(directory); depth++)
            {
                string candidate = Path.Combine(directory, "version.json");
                if (File.Exists(candidate))
                    return candidate;
                directory = Directory.GetParent(directory)?.FullName;
            }

            return null;
        }

        private sealed class Metadata
        {
            public string Version { get; set; } = FallbackApplicationVersion;
            public string DvlFormatVersion { get; set; } = FallbackDvlFormatVersion;
            public string DocumentSchemaVersion { get; set; } = FallbackDocumentSchemaVersion;

            public static Metadata Fallback() => new();
        }
    }
}
