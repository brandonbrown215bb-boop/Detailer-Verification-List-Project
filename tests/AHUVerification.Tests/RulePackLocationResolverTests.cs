using System;
using System.Collections.Generic;
using System.IO;
using Xunit;
using AHUVerification.Core.Services;

namespace AHUVerification.Tests
{
    public class RulePackLocationResolverTests
    {
        [Fact]
        public void ResolveLocation_ExplicitlyConfiguredPath_TakesPrecedence()
        {
            string configured = @"C:\Custom\SharedRules";
            var existingDirs = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { configured };
            var existingFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { Path.Combine(configured, "manifest.json") };

            var result = RulePackLocationResolver.ResolveLocation(
                configuredPath: configured,
                envGetter: key => null,
                dirExists: path => existingDirs.Contains(path),
                fileExists: path => existingFiles.Contains(path)
            );

            Assert.Equal(configured, result.Path);
            Assert.False(result.IsAutoDetected);
            Assert.Equal("Configured", result.SourceType);
        }

        [Fact]
        public void ResolveLocation_CustomEnvironmentVariable_UsedWhenNoConfiguredPath()
        {
            string envDir = @"D:\Corporate\RulePack";
            var existingDirs = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { envDir };
            var existingFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { Path.Combine(envDir, "manifest.json") };

            var result = RulePackLocationResolver.ResolveLocation(
                configuredPath: null,
                envGetter: key => key == "DVL_RULEPACK_PATH" ? envDir : null,
                dirExists: path => existingDirs.Contains(path),
                fileExists: path => existingFiles.Contains(path)
            );

            Assert.Equal(envDir, result.Path);
            Assert.True(result.IsAutoDetected);
            Assert.Equal("Environment", result.SourceType);
        }

        [Fact]
        public void ResolveLocation_OneDriveCommercialSharePointSync_ResolvesSubpath()
        {
            string odCommercial = @"C:\Users\testuser\OneDrive - Johnson Controls";
            string targetFolder = Path.Combine(odCommercial, "UNIT DETAILING VERIFICATION LIST", "RulePack");

            var existingDirs = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                odCommercial,
                targetFolder
            };
            var existingFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                Path.Combine(targetFolder, "manifest.json")
            };

            var result = RulePackLocationResolver.ResolveLocation(
                configuredPath: null,
                envGetter: key => key == "OneDriveCommercial" ? odCommercial : null,
                dirExists: path => existingDirs.Contains(path),
                fileExists: path => existingFiles.Contains(path)
            );

            Assert.Equal(targetFolder, result.Path);
            Assert.True(result.IsAutoDetected);
            Assert.Equal("SharePointSync", result.SourceType);
        }

        [Fact]
        public void ResolveLocation_UserProfileJohnsonControlsFolder_ResolvesSubpath()
        {
            string userProfile = @"C:\Users\remoteuser";
            string jciRoot = Path.Combine(userProfile, "Johnson Controls");
            string targetFolder = Path.Combine(jciRoot, "Detailing - Documents", "UNIT DETAILING VERIFICATION LIST");

            var existingDirs = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                userProfile,
                jciRoot,
                targetFolder
            };
            var existingFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                Path.Combine(targetFolder, "manifest.json")
            };

            var result = RulePackLocationResolver.ResolveLocation(
                configuredPath: null,
                envGetter: key => key == "USERPROFILE" ? userProfile : null,
                dirExists: path => existingDirs.Contains(path),
                fileExists: path => existingFiles.Contains(path)
            );

            Assert.Equal(targetFolder, result.Path);
            Assert.True(result.IsAutoDetected);
            Assert.Equal("SharePointSync", result.SourceType);
        }

        [Fact]
        public void ResolveLocation_DirectoryExistsWithoutManifest_Ignored()
        {
            string odCommercial = @"C:\Users\testuser\OneDrive - Johnson Controls";
            string emptyFolder = Path.Combine(odCommercial, "UNIT DETAILING VERIFICATION LIST");

            var existingDirs = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                odCommercial,
                emptyFolder
            };
            // No manifest.json registered in existingFiles!
            var existingFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var result = RulePackLocationResolver.ResolveLocation(
                configuredPath: null,
                envGetter: key => key == "OneDriveCommercial" ? odCommercial : null,
                dirExists: path => existingDirs.Contains(path),
                fileExists: path => existingFiles.Contains(path)
            );

            Assert.Null(result.Path);
            Assert.False(result.IsAutoDetected);
            Assert.Equal("None", result.SourceType);
        }

        [Fact]
        public void ResolveLocation_NoCandidatesFound_ReturnsNoneAndNull()
        {
            var result = RulePackLocationResolver.ResolveLocation(
                configuredPath: null,
                envGetter: key => null,
                dirExists: path => false,
                fileExists: path => false
            );

            Assert.Null(result.Path);
            Assert.False(result.IsAutoDetected);
            Assert.Equal("None", result.SourceType);
        }
    }
}
