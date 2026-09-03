using System.IO;
using AHUVerification.Core.Utils;

namespace AHUVerification.Tests
{
    public static class TestPathHelper
    {
        public static string RepoRoot => PathUtils.FindRepoRoot();

        public static string GetRepoPath(string relativePath) => PathUtils.ResolveRepoPath(relativePath);

        public static string GetFixturePath(string relativePath)
        {
            // First check tests/fixtures/{relativePath}
            string fixturePath = Path.Combine(RepoRoot, "tests", "fixtures", relativePath);
            if (File.Exists(fixturePath) || Directory.Exists(fixturePath))
                return fixturePath;

            // Check direct file name under tests/fixtures/{fileName}
            string directFixture = Path.Combine(RepoRoot, "tests", "fixtures", Path.GetFileName(relativePath));
            if (File.Exists(directFixture) || Directory.Exists(directFixture))
                return directFixture;

            // Fallback to repo root if needed
            string repoPath = PathUtils.ResolveRepoPath(relativePath);
            if (File.Exists(repoPath) || Directory.Exists(repoPath))
                return repoPath;

            return fixturePath;
        }
    }
}
