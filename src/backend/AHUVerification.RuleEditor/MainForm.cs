using System;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Utils;
using AHUVerification.RuleEditor.Bridge;

namespace AHUVerification.RuleEditor
{
    public partial class MainForm : Form
    {
        private readonly WebView2 _webView;
        private RuleEditorBridgeHandler? _bridgeHandler;

        public MainForm()
        {
            Text = "AHU Verification • Rule & Logic Editor Studio";
            Size = new Size(1500, 950);
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
                using var iconStream = typeof(MainForm).Assembly.GetManifestResourceStream("RuleEditor.app.ico")
                    ?? typeof(MainForm).Assembly.GetManifestResourceStream("AHUVerification.RuleEditor.app.ico");
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
                string localData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AHUVerificationRuleEditor");
                string webViewUserData = Path.Combine(localData, "WebView2Data");
                Directory.CreateDirectory(webViewUserData);

                var env = await CoreWebView2Environment.CreateAsync(null, webViewUserData);
                await _webView.EnsureCoreWebView2Async(env);

                string appBase = AppContext.BaseDirectory;
                string rulePackPath = Path.Combine(appBase, "resources", "rulepack");
                string distFolder = Path.Combine(appBase, "dist");

#if DEBUG
                string repoRoot = PathUtils.FindRepoRoot();
                string repositoryRulePack = Path.Combine(repoRoot, "src", "rulepack");
                string repositoryDist = Path.Combine(repoRoot, "dist");
                if (Directory.Exists(repositoryRulePack)) rulePackPath = repositoryRulePack;
                if (Directory.Exists(repositoryDist)) distFolder = repositoryDist;
                if (!Directory.Exists(rulePackPath))
                {
                    rulePackPath = Path.Combine(repoRoot, "resources", "rulepack");
                }
#endif

                string[] args = Environment.GetCommandLineArgs();
                string? requestedRulePack = GetRulePackArgument(args);
                if (!string.IsNullOrWhiteSpace(requestedRulePack) && Directory.Exists(requestedRulePack))
                {
                    rulePackPath = Path.GetFullPath(requestedRulePack);
                }

                if (!Directory.Exists(rulePackPath))
                    throw new DirectoryNotFoundException($"Packaged Rule Pack not found: {rulePackPath}");
                if (!File.Exists(Path.Combine(distFolder, "rule-editor.html")))
                    throw new FileNotFoundException("Packaged web interface not found.", Path.Combine(distFolder, "rule-editor.html"));

#if !DEBUG
                string? defaultPublishPath = @"P:\Detailing\DVL Rulepack";
#else
                string? defaultPublishPath = null;
#endif
                _bridgeHandler = new RuleEditorBridgeHandler(this, rulePackPath, defaultPublishPath: defaultPublishPath);
                _webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

                _webView.CoreWebView2.NewWindowRequested += (s, ev) => ev.Handled = true;
                _webView.CoreWebView2.NavigationStarting += (s, ev) => ev.Cancel = !IsAllowedOrigin(ev.Uri);

#if !DEBUG
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
#endif

                // Configure Virtual Host mapping for built frontend
                _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "rule-editor.local",
                    distFolder,
                    CoreWebView2HostResourceAccessKind.Allow
                );

#if DEBUG
                // Check if Vite dev server is running
                bool devServerActive = await IsDevServerRunningAsync("http://localhost:5173/rule-editor.html");
                if (devServerActive)
                {
                    _webView.CoreWebView2.Navigate("http://localhost:5173/rule-editor.html");
                }
                else
                {
                    _webView.CoreWebView2.Navigate("https://rule-editor.local/rule-editor.html");
                }
#else
                _webView.CoreWebView2.Navigate("https://rule-editor.local/rule-editor.html");
#endif
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to initialize Rule Editor WebView2 interface: {ex.Message}", "Rule Editor Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string? message = null;
            try
            {
                if (!IsAllowedOrigin(e.Source)) return;
                message = e.TryGetWebMessageAsString();
                if (string.IsNullOrEmpty(message)) return;

                if (_bridgeHandler != null)
                {
                    var response = _bridgeHandler.Handle(message);
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

        private static bool IsAllowedOrigin(string? value)
        {
            if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)) return false;
            if (string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(uri.Host, "rule-editor.local", StringComparison.OrdinalIgnoreCase) &&
                uri.Port == 443)
            {
                return true;
            }

#if DEBUG
            return string.Equals(uri.Scheme, "http", StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase) &&
                   uri.Port == 5173;
#else
            return false;
#endif
        }

        private static string? GetRulePackArgument(string[] args)
        {
            for (int index = 1; index < args.Length; index++)
            {
                if (string.Equals(args[index], "--rule-pack", StringComparison.OrdinalIgnoreCase) && index + 1 < args.Length)
                    return args[index + 1];

                // Preserve the existing positional launch contract for local
                // scripts while preferring the explicit named argument.
                if (!args[index].StartsWith("-", StringComparison.Ordinal) && Directory.Exists(args[index]))
                    return args[index];
            }

            return null;
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
