using System;
using System.IO;

namespace AHUVerification.Core.Utils
{
    public static class PathUtils
    {
        private static string? _cachedRepoRoot;

        public static string FindRepoRoot()
        {
            if (_cachedRepoRoot != null) return _cachedRepoRoot;

            string current = AppContext.BaseDirectory;
            for (int i = 0; i < 10; i++)
            {
                if (File.Exists(Path.Combine(current, "Detailing Verification List.xlsx")) ||
                    File.Exists(Path.Combine(current, "package.json")) ||
                    File.Exists(Path.Combine(current, "Config.xml")))
                {
                    _cachedRepoRoot = current;
                    return current;
                }
                var parent = Directory.GetParent(current);
                if (parent == null) break;
                current = parent.FullName;
            }

            _cachedRepoRoot = Directory.GetCurrentDirectory();
            return _cachedRepoRoot;
        }

        public static string ResolveRepoPath(string relativePath) =>
            Path.Combine(FindRepoRoot(), relativePath);
    }
}

