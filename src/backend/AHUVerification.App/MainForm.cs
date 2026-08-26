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
                string rulePackPath = Path.Combine(appBase, "resources", "rulepack");
                string distFolder = Path.Combine(appBase, "dist");

#if DEBUG
                string repoRoot = FindRepoRoot();
                string repositoryRulePack = Path.Combine(repoRoot, "src", "rulepack");
                string repositoryDist = Path.Combine(repoRoot, "dist");
                if (Directory.Exists(repositoryRulePack)) rulePackPath = repositoryRulePack;
                if (Directory.Exists(repositoryDist)) distFolder = repositoryDist;
#endif

                if (!Directory.Exists(rulePackPath))
                    throw new DirectoryNotFoundException($"Packaged Rule Pack not found: {rulePackPath}");
                if (!File.Exists(Path.Combine(distFolder, "index.html")))
                    throw new FileNotFoundException("Packaged web interface not found.", Path.Combine(distFolder, "index.html"));

                _bridgeHandler = new BridgeHandler(this, rulePackPath);
                _webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

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

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string message = e.TryGetWebMessageAsString();
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
                var errorResponse = new BridgeResponse
                {
                    Success = false,
                    Error = ex.Message
                };
                string jsonResponse = JsonSerializer.Serialize(errorResponse);
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

        private static string FindRepoRoot()
        {
            string current = AppContext.BaseDirectory;
            for (int i = 0; i < 10; i++)
            {
                if (File.Exists(Path.Combine(current, "Detailing Verification List.xlsx")) ||
                    File.Exists(Path.Combine(current, "package.json")))
                {
                    return current;
                }
                var parent = Directory.GetParent(current);
                if (parent == null) break;
                current = parent.FullName;
            }
            return Directory.GetCurrentDirectory();
        }
#endif
    }
}
