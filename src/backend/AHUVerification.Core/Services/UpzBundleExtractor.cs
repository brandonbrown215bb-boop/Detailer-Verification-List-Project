using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Xml.Linq;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;

namespace AHUVerification.Core.Services
{
    public class UpzBundleExtractor
    {
        private readonly string _toolsDirectory;
        private readonly OrderRevParser _orderRevParser = new();

        public UpzBundleExtractor(string? customToolsDirectory = null)
        {
            _toolsDirectory = ResolveToolsDirectory(customToolsDirectory);
        }

        public static string ResolveToolsDirectory(string? customDir = null)
        {
            if (!string.IsNullOrWhiteSpace(customDir) && Directory.Exists(customDir))
                return customDir;

            string baseDir = AppContext.BaseDirectory;
            
            // Check baseDir/resources/bin
            string subDir = Path.Combine(baseDir, "resources", "bin");
            if (Directory.Exists(subDir) && File.Exists(Path.Combine(subDir, "unpack32.exe")))
                return subDir;

            // Check baseDir directly
            if (File.Exists(Path.Combine(baseDir, "unpack32.exe")))
                return baseDir;

            // Check repository relative paths
            string repoAppBin = Path.Combine(baseDir, "..", "..", "..", "..", "src", "backend", "AHUVerification.App", "resources", "bin");
            if (Directory.Exists(repoAppBin) && File.Exists(Path.Combine(repoAppBin, "unpack32.exe")))
                return Path.GetFullPath(repoAppBin);

            // Check repository / dev fallback locations
            string devPath = @"C:\Users\jbrow263\source\repos\JCI.MOM.Legacy\SolutionSource\BoundaryUpz";
            if (Directory.Exists(devPath) && File.Exists(Path.Combine(devPath, "unpack32.exe")))
                return devPath;

            return subDir;
        }

        public UpzBundle Extract(string upzFilePath)
        {
            if (!File.Exists(upzFilePath))
                throw new FileNotFoundException($"UPZ file not found: {upzFilePath}");

            string unpackExe = Path.Combine(_toolsDirectory, "unpack32.exe");
            if (!File.Exists(unpackExe))
                throw new FileNotFoundException($"unpack32.exe not found in tools directory: {_toolsDirectory}");

            string tempDir = Path.Combine(Path.GetTempPath(), "DVL_UPZ_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDir);

            try
            {
                // unpack32 requires trailing slash on destination directory
                string destDir = tempDir.EndsWith(Path.DirectorySeparatorChar.ToString())
                    ? tempDir
                    : tempDir + Path.DirectorySeparatorChar;

                var startInfo = new ProcessStartInfo
                {
                    FileName = unpackExe,
                    Arguments = $"\"{upzFilePath}\" \"{destDir}\"",
                    WorkingDirectory = _toolsDirectory,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                using var process = Process.Start(startInfo);
                if (process == null)
                    throw new InvalidOperationException("Failed to launch unpack32.exe process.");

                if (!process.WaitForExit(30000))
                {
                    process.Kill();
                    throw new TimeoutException("UPZ decompression timed out after 30 seconds.");
                }

                var bundle = new UpzBundle();

                string configPath = Path.Combine(tempDir, "Config.xml");
                string orderRevPath = Path.Combine(tempDir, "OrderRev.xml");
                string manifestPath = Path.Combine(tempDir, "Manifest.xml");

                if (File.Exists(configPath))
                {
                    bundle.RawConfigXml = File.ReadAllText(configPath);
                }
                else
                {
                    // Look for any .xml file containing configuration
                    var xmlFiles = Directory.GetFiles(tempDir, "*.xml");
                    var matched = xmlFiles.FirstOrDefault(f => Path.GetFileName(f).Equals("Config.xml", StringComparison.OrdinalIgnoreCase));
                    if (matched != null)
                        bundle.RawConfigXml = File.ReadAllText(matched);
                    else
                        throw new FileNotFoundException("Config.xml not found inside decompressed UPZ bundle.");
                }

                if (File.Exists(orderRevPath))
                {
                    bundle.RawOrderRevXml = File.ReadAllText(orderRevPath);
                    bundle.OrderRevision = _orderRevParser.Parse(bundle.RawOrderRevXml);
                }

                if (File.Exists(manifestPath))
                {
                    bundle.RawManifestXml = File.ReadAllText(manifestPath);
                    bundle.Manifest = ParseManifest(bundle.RawManifestXml);
                }

                return bundle;
            }
            finally
            {
                try
                {
                    if (Directory.Exists(tempDir))
                        Directory.Delete(tempDir, true);
                }
                catch
                {
                    // Ignore temp deletion errors
                }
            }
        }

        private static ManifestData ParseManifest(string xmlContent)
        {
            var data = new ManifestData();
            try
            {
                var doc = XDocument.Parse(xmlContent);
                var root = doc.Root;
                if (root == null) return data;

                foreach (var el in root.Descendants().Where(e => e.Name.LocalName.Equals("fileName", StringComparison.OrdinalIgnoreCase)))
                {
                    var val = el.Value?.Trim();
                    if (!string.IsNullOrEmpty(val))
                        data.FileEntries.Add(val);
                }

                var genNameEl = root.Descendants().FirstOrDefault(e => e.Name.LocalName.Equals("generatingSoftwareName", StringComparison.OrdinalIgnoreCase));
                if (genNameEl != null)
                    data.GeneratingSoftwareName = genNameEl.Value?.Trim() ?? "";
            }
            catch
            {
            }
            return data;
        }
    }
}
