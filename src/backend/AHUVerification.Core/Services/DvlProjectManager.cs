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
            string generalComments = "",
            string rulePackVersion = "13.1.0",
            string rulePackSha = "")
        {
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
            string? dir = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            File.WriteAllText(filePath, json, Encoding.UTF8);
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
    }
}
