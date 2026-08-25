using System;
using System.IO;

namespace AHUVerification.Tests
{
    public static class TestPathHelper
    {
        private static string? _repoRoot;

        public static string RepoRoot
        {
            get
            {
                if (_repoRoot != null) return _repoRoot;

                string current = AppContext.BaseDirectory;
                for (int i = 0; i < 10; i++)
                {
                    if (File.Exists(Path.Combine(current, "Detailing Verification List.xlsx")) ||
                        File.Exists(Path.Combine(current, "Config.xml")))
                    {
                        _repoRoot = current;
                        return _repoRoot;
                    }
                    var parent = Directory.GetParent(current);
                    if (parent == null) break;
                    current = parent.FullName;
                }

                _repoRoot = Directory.GetCurrentDirectory();
                return _repoRoot;
            }
        }

        public static string GetRepoPath(string relativePath)
        {
            return Path.Combine(RepoRoot, relativePath);
        }
    }
}
