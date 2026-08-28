using AHUVerification.Core.Utils;

namespace AHUVerification.Tests
{
    public static class TestPathHelper
    {
        public static string RepoRoot => PathUtils.FindRepoRoot();

        public static string GetRepoPath(string relativePath) => PathUtils.ResolveRepoPath(relativePath);
    }
}
