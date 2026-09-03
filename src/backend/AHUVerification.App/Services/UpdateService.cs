using System;
using System.Threading.Tasks;
using Velopack;
using Velopack.Sources;

namespace AHUVerification.App.Services
{
    public class AppUpdateCheckResult
    {
        public bool IsInstalled { get; set; }
        public bool HasUpdate { get; set; }
        public string? CurrentVersion { get; set; }
        public string? RemoteVersion { get; set; }
        public string? Error { get; set; }
    }

    public class UpdateService
    {
        private const string RepoUrl = "https://github.com/brandonbrown215bb-boop/Detailer-Verification-List-Project";
        private readonly UpdateManager? _updateManager;
        private UpdateInfo? _pendingUpdate;

        public UpdateService()
        {
            try
            {
                var source = new GithubSource(RepoUrl, null, false);
                _updateManager = new UpdateManager(source);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UpdateService] Initialization notice: {ex.Message}");
            }
        }

        public bool IsInstalled => _updateManager?.IsInstalled ?? false;

        public async Task<AppUpdateCheckResult> CheckForUpdatesAsync()
        {
            if (_updateManager == null || !_updateManager.IsInstalled)
            {
                return new AppUpdateCheckResult
                {
                    IsInstalled = false,
                    HasUpdate = false,
                    CurrentVersion = "dev"
                };
            }

            try
            {
                var currentVer = _updateManager.CurrentVersion?.ToFullString() ?? "1.0.0";
                var updateInfo = await _updateManager.CheckForUpdatesAsync();

                if (updateInfo == null)
                {
                    return new AppUpdateCheckResult
                    {
                        IsInstalled = true,
                        HasUpdate = false,
                        CurrentVersion = currentVer
                    };
                }

                _pendingUpdate = updateInfo;
                var remoteVer = updateInfo.TargetFullRelease.Version.ToFullString();

                return new AppUpdateCheckResult
                {
                    IsInstalled = true,
                    HasUpdate = true,
                    CurrentVersion = currentVer,
                    RemoteVersion = remoteVer
                };
            }
            catch (Exception ex)
            {
                return new AppUpdateCheckResult
                {
                    IsInstalled = true,
                    HasUpdate = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<bool> DownloadUpdatesAsync(Action<int>? progress = null)
        {
            if (_updateManager == null || _pendingUpdate == null) return false;

            try
            {
                await _updateManager.DownloadUpdatesAsync(_pendingUpdate, progress);
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UpdateService] Failed to download update: {ex.Message}");
                return false;
            }
        }

        public void ApplyUpdatesAndRestart()
        {
            if (_updateManager == null || _pendingUpdate == null) return;
            _updateManager.ApplyUpdatesAndRestart(_pendingUpdate);
        }
    }
}

