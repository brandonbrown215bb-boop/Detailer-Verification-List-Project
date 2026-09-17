using System;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using AHUVerification.App.Bridge;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Utils;

namespace AHUVerification.App
{
    public partial class MainForm : Form
    {
        private readonly WebView2 _webView;
        private BridgeHandler? _bridgeHandler;

        public MainForm()
        {
            Text = "AHU Detailing Verification Desktop Application";
            Size = new Size(1440, 900);
            MinimumSize = new Size(1100, 720);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(15, 23, 42); // slate-900

            _webView = new WebView2
            {
                Dock = DockStyle.Fill
            };
            Controls.Add(_webView);

            try
            {
                using var iconStream = typeof(MainForm).Assembly.GetManifestResourceStream("AHUVerification.App.app.ico");
                if (iconStream != null)
                {
                    Icon = new Icon(iconStream);
                }
                else
                {
                    string? exePath = Environment.ProcessPath ?? Application.ExecutablePath;
                    if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                    {
                        var extracted = Icon.ExtractAssociatedIcon(exePath);
                        if (extracted != null) Icon = extracted;
                    }
                }
            }
            catch
            {
                // Graceful fallback to default system icon
            }

            Load += MainForm_Load;
        }

        private async void MainForm_Load(object? sender, EventArgs e)
        {
            await InitializeWebViewAsync();
        }

        private async Task InitializeWebViewAsync()
        {
            try
            {
                string localData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AHUVerification");
                string webViewUserData = Path.Combine(localData, "WebView2Data");
                Directory.CreateDirectory(webViewUserData);

                var env = await CoreWebView2Environment.CreateAsync(null, webViewUserData);
                await _webView.EnsureCoreWebView2Async(env);

                string appBase = AppContext.BaseDirectory;
                string distFolder = Path.Combine(appBase, "dist");
                string packagedRulePack = Path.Combine(appBase, "resources", "rulepack");
                string localActiveRulePack = Path.Combine(localData, "active_rulepack");

                string rulePackPath = packagedRulePack;

                // Priority 1: Synced active_rulepack from LocalApplicationData if present and valid
                if (Directory.Exists(localActiveRulePack) && File.Exists(Path.Combine(localActiveRulePack, "manifest.json")))
                {
                    try
                    {
                        var testManager = new AHUVerification.Core.Services.RulePackManager();
                        var testBundle = testManager.LoadFromDirectory(localActiveRulePack);
                        if (testBundle.IsValid)
                        {
                            rulePackPath = localActiveRulePack;
                        }
                    }
                    catch
                    {
                        // Fall back to baseline packaged rulepack
                    }
                }

#if DEBUG
                string repoRoot = PathUtils.FindRepoRoot();
                string repositoryRulePack = Path.Combine(repoRoot, "resources", "rulepack");
                string repositoryDist = Path.Combine(repoRoot, "dist");
                if (Directory.Exists(repositoryRulePack) && !Directory.Exists(localActiveRulePack)) rulePackPath = repositoryRulePack;
                if (Directory.Exists(repositoryDist)) distFolder = repositoryDist;
#else
                // Release build fallback: if no local active rulepack exists yet, check corporate share before packaged rulepack
                const string defaultReleaseRulePack = @"P:\Detailing\DVL Rulepack";
                if (rulePackPath == packagedRulePack && Directory.Exists(defaultReleaseRulePack) && File.Exists(Path.Combine(defaultReleaseRulePack, "manifest.json")))
                {
                    try
                    {
                        var testManager = new AHUVerification.Core.Services.RulePackManager();
                        var testBundle = testManager.LoadFromDirectory(defaultReleaseRulePack);
                        if (testBundle.IsValid)
                        {
                            rulePackPath = defaultReleaseRulePack;
                        }
                    }
                    catch
                    {
                        // Fall back to packagedRulePack
                    }
                }
#endif

                if (!Directory.Exists(rulePackPath))
                    throw new DirectoryNotFoundException($"Rule Pack directory not found: {rulePackPath}");
                if (!File.Exists(Path.Combine(distFolder, "index.html")))
                    throw new FileNotFoundException("Packaged web interface not found.", Path.Combine(distFolder, "index.html"));

                _bridgeHandler = new BridgeHandler(this, rulePackPath);
                _webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
                _webView.CoreWebView2.NavigationStarting += CoreWebView2_NavigationStarting;
                _webView.CoreWebView2.NewWindowRequested += CoreWebView2_NewWindowRequested;

#if !DEBUG
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
#endif

                // Configure Virtual Host mapping for built frontend
                _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "ahu-verification.local",
                    distFolder,
                    CoreWebView2HostResourceAccessKind.Allow
                );

#if DEBUG
                // Check if Vite dev server is running
                bool devServerActive = await IsDevServerRunningAsync("http://localhost:5173");
                if (devServerActive)
                {
                    _webView.CoreWebView2.Navigate("http://localhost:5173");
                }
                else
                {
                    _webView.CoreWebView2.Navigate("https://ahu-verification.local/index.html");
                }
#else
                _webView.CoreWebView2.Navigate("https://ahu-verification.local/index.html");
#endif
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to initialize WebView2 interface: {ex.Message}", "AHU Verification Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        public static bool IsAllowedOrigin(string? uri)
        {
            if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsed)) return false;
            if (string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
                && string.Equals(parsed.Host, "ahu-verification.local", StringComparison.OrdinalIgnoreCase)
                && (parsed.IsDefaultPort || parsed.Port == 443)) return true;
#if DEBUG
            if (string.Equals(parsed.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
                && string.Equals(parsed.Host, "localhost", StringComparison.OrdinalIgnoreCase)
                && parsed.Port == 5173) return true;
#endif
            return false;
        }

        private void CoreWebView2_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
        {
            e.Cancel = !IsAllowedOrigin(e.Uri);
        }

        private void CoreWebView2_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
        }

        private async void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            if (!IsAllowedOrigin(e.Source))
            {
                return;
            }

            string? message = null;
            try
            {
                message = e.TryGetWebMessageAsString();
                if (string.IsNullOrEmpty(message)) return;

                if (_bridgeHandler != null)
                {
                    var response = await _bridgeHandler.HandleAsync(message);
                    string jsonResponse = JsonSerializer.Serialize(response, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                    _webView.CoreWebView2.PostWebMessageAsJson(jsonResponse);
                }
            }
            catch (Exception ex)
            {
                string reqId = BridgeRequest.ExtractRequestId(message);
                var errorResponse = BridgeResponse.Fail(reqId, ex.Message);
                string jsonResponse = JsonSerializer.Serialize(errorResponse, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                _webView.CoreWebView2.PostWebMessageAsJson(jsonResponse);
            }
        }

#if DEBUG
        private static async Task<bool> IsDevServerRunningAsync(string url)
        {
            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(500) };
                var res = await client.GetAsync(url);
                return res.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
#endif
    }
}
