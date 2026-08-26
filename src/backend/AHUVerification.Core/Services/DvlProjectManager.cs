using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Services
{
    public class DvlProjectManager
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            WriteIndented = true,
            PropertyNameCaseInsensitive = true
        };

        public DvlProjectFile CreateProject(
            NormalizedXmlGraph graph,
            Dictionary<string, Fact> facts,
            List<SpecialQuote> sqItems,
            List<ChecklistInstance> checklists,
            string rawXml,
            string rulePackVersion,
            string rulePackSha,
            string generalComments = "")
        {
            if (string.IsNullOrWhiteSpace(rulePackVersion))
                throw new ArgumentException("A Rule Pack version is required.", nameof(rulePackVersion));
            if (!IsFullSha256(rulePackSha))
                throw new ArgumentException("A full Rule Pack SHA-256 is required.", nameof(rulePackSha));

            string author = facts.TryGetValue("unit.detailer", out var af) ? af.Value?.ToString() ?? "Detailer" : "Detailer";
            string jobName = facts.TryGetValue("unit.jobName", out var jf) ? jf.Value?.ToString() ?? "AHU Project" : "AHU Project";
            string comNumber = facts.TryGetValue("unit.comNumber", out var cf) ? cf.Value?.ToString() ?? "COM-000000" : "COM-000000";

            string xmlSha = ComputeSha256(rawXml);

            return new DvlProjectFile
            {
                FormatVersion = "1.0",
                AppVersion = "1.0.0",
                CreatedAt = DateTime.UtcNow.ToString("o"),
                LastSavedAt = DateTime.UtcNow.ToString("o"),
                Author = author,
                JobName = jobName,
                ComNumber = comNumber,
                RulePack = new RulePackInfo
                {
                    Version = rulePackVersion,
                    Sha256 = rulePackSha
                },
                SourceXml = new SourceXmlInfo
                {
                    FileName = "Config.xml",
                    FileSha256 = xmlSha,
                    SchemaVersion = graph.DocumentVersion,
                    RawXml = rawXml
                },
                NormalizedGraph = graph,
                FactRegistry = facts,
                SqItems = sqItems,
                ChecklistInstances = checklists,
                GeneralComments = generalComments
            };
        }

        public void SaveToFile(DvlProjectFile project, string filePath)
        {
            project.LastSavedAt = DateTime.UtcNow.ToString("o");
            string json = JsonSerializer.Serialize(project, JsonOptions);
            SaveJsonToFile(json, filePath);
        }

        public void SaveJsonToFile(string json, string filePath)
        {
            if (string.IsNullOrWhiteSpace(filePath) || !Path.IsPathFullyQualified(filePath))
                throw new ArgumentException("DVL save path must be an absolute path selected by the user.", nameof(filePath));
            if (!string.Equals(Path.GetExtension(filePath), ".dvl", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("DVL save path must use the .dvl extension.", nameof(filePath));

            string fullPath = Path.GetFullPath(filePath);
            string? dir = Path.GetDirectoryName(fullPath);
            if (string.IsNullOrEmpty(dir))
                throw new InvalidOperationException("DVL save path has no parent directory.");
            Directory.CreateDirectory(dir);

            string tempPath = Path.Combine(dir, $".{Path.GetFileName(fullPath)}.{Guid.NewGuid():N}.tmp");
            try
            {
                byte[] bytes = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false).GetBytes(json);
                using (var stream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    stream.Write(bytes, 0, bytes.Length);
                    stream.Flush(flushToDisk: true);
                }
                File.Move(tempPath, fullPath, overwrite: true);
            }
            finally
            {
                if (File.Exists(tempPath))
                    File.Delete(tempPath);
            }
        }

        public DvlProjectFile LoadFromFile(string filePath)
        {
            if (!File.Exists(filePath))
                throw new FileNotFoundException("DVL project file not found.", filePath);

            string json = File.ReadAllText(filePath, Encoding.UTF8);
            return JsonSerializer.Deserialize<DvlProjectFile>(json, JsonOptions)
                ?? throw new InvalidOperationException("Failed to deserialize DVL project file.");
        }

        public static string ComputeSha256(string content)
        {
            using var sha = SHA256.Create();
            byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(content));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        public static string ComputeFileSha256(string filePath)
        {
            using var sha = SHA256.Create();
            using var stream = File.OpenRead(filePath);
            byte[] bytes = sha.ComputeHash(stream);
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        private static bool IsFullSha256(string value)
        {
            if (string.IsNullOrEmpty(value) || value.Length != 64) return false;
            foreach (char character in value)
            {
                if (!Uri.IsHexDigit(character)) return false;
            }
            return true;
        }
    }
}
