using System.Collections.Concurrent;
using System.Text.Json;
using System.Windows.Forms;
using AHUVerification.App.Bridge;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Utils;
using AHUVerification.RuleEditor.Bridge;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AHUVerification.Tests;

/// <summary>
/// Real Windows WebView2 transport and built-entry asset smoke. This isolated
/// harness uses production handlers, but does not claim installer or full UI E2E coverage.
/// </summary>
public class WebViewHostSmokeTests
{
    [Theory]
    [Trait("Category", "WindowsHost")]
    [InlineData("index.html", false)]
    [InlineData("rule-editor.html", true)]
    public async Task BuiltEntry_LoadsLocalAssetsAndExchangesNativeMessages(string entry, bool editor)
    {
        string dist = TestPathHelper.GetRepoPath("dist");
        Assert.True(File.Exists(Path.Combine(dist, entry)), "Run npm run build before Windows host smoke tests.");
        Assert.False(string.IsNullOrWhiteSpace(CoreWebView2Environment.GetAvailableBrowserVersionString()));
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() =>
        {
            using var form = new Form { ShowInTaskbar = false, Opacity = 0, Width = 1200, Height = 850 };
            using var view = new WebView2 { Dock = DockStyle.Fill };
            form.Controls.Add(view);
            form.Shown += async (_, _) =>
            {
                try
                {
                    string data = TestPathHelper.GetRepoPath($"TestResults/webview/{Guid.NewGuid():N}");
                    var environment = await CoreWebView2Environment.CreateAsync(null, data);
                    await view.EnsureCoreWebView2Async(environment);
                    var core = view.CoreWebView2;
                    core.Settings.AreDevToolsEnabled = false;
                    const string origin = "https://ahu-verification.local";
                    core.SetVirtualHostNameToFolderMapping("ahu-verification.local", dist, CoreWebView2HostResourceAccessKind.Allow);
                    var assetFailures = new ConcurrentQueue<string>();
                    core.WebResourceResponseReceived += (_, response) =>
                    {
                        if (response.Request.Uri.StartsWith(origin + "/", StringComparison.Ordinal) && response.Response.StatusCode >= 400)
                            assetFailures.Enqueue($"{response.Response.StatusCode}: {response.Request.Uri}");
                    };
                    string pack = TestPathHelper.GetRepoPath("resources/rulepack");
                    var mainHandler = editor ? null : new BridgeHandler(pack);
                    var editorHandler = editor ? new RuleEditorBridgeHandler(pack) : null;
                    core.WebMessageReceived += async (_, message) =>
                    {
                        try
                        {
                            Assert.Equal(new Uri(origin).Authority, new Uri(message.Source).Authority);
                            string raw = message.TryGetWebMessageAsString();
                            using var request = JsonDocument.Parse(raw);
                            string action = request.RootElement.GetProperty("action").GetString()!;
                            // Bootstrap reads use real production handlers. External updates,
                            // dialogs, and filesystem mutations are outside this isolated smoke.
                            var response = action is "getAppInfo" or "getRulePack" || (!editor && action == "verifySource") || (editor && action == "evaluateRuleSandbox")
                                ? (editor ? editorHandler!.Handle(raw) : await mainHandler!.HandleAsync(raw))
                                : BridgeResponse.Fail(BridgeRequest.ExtractRequestId(raw), "Not enabled in read-only host smoke");
                            var jsonOptions = JsonDefaults.CreateFlexibleOptions();
                            jsonOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
                            core.PostWebMessageAsJson(JsonSerializer.Serialize(response, jsonOptions));
                        }
                        catch (Exception error) { completion.TrySetException(error); }
                    };
                    var navigation = new TaskCompletionSource<bool>();
                    core.NavigationCompleted += (_, result) => navigation.TrySetResult(result.IsSuccess);
                    core.Navigate($"{origin}/{entry}");
                    Assert.True(await navigation.Task.WaitAsync(TimeSpan.FromSeconds(20)));
                    await core.ExecuteScriptAsync("window.__smokeResponses={}; window.chrome.webview.addEventListener('message',e=>{const r=typeof e.data==='string'?JSON.parse(e.data):e.data; if(r.id?.startsWith('smoke-')) window.__smokeResponses[r.id]=r;}); window.chrome.webview.postMessage(JSON.stringify({id:'smoke-info',action:'getAppInfo',payload:{}})); window.chrome.webview.postMessage(JSON.stringify({id:'smoke-pack',action:'getRulePack',payload:{}}));");
                    bool ready = false;
                    for (int attempt = 0; attempt < 100 && !ready; attempt++)
                    {
                        ready = await core.ExecuteScriptAsync("Boolean(window.__smokeResponses['smoke-info'] && window.__smokeResponses['smoke-pack'] && document.querySelector('#root')?.children.length)") == "true";
                        if (!ready) await Task.Delay(100);
                    }
                    if (!ready)
                    {
                        string smokeResponsesJson = await core.ExecuteScriptAsync("JSON.stringify(window.__smokeResponses)");
                        string rootChildrenCount = await core.ExecuteScriptAsync("document.querySelector('#root')?.children.length?.toString() ?? 'null'");
                        string documentReadyState = await core.ExecuteScriptAsync("document.readyState");
                        throw new InvalidOperationException($"Built entry {entry} did not render or receive native responses. readyState={documentReadyState}, rootChildren={rootChildrenCount}, responses={smokeResponsesJson}, assetFailures={string.Join("; ", assetFailures)}");
                    }
                    using var results = JsonDocument.Parse(await core.ExecuteScriptAsync("window.__smokeResponses"));
                    Assert.True(results.RootElement.GetProperty("smoke-info").GetProperty("success").GetBoolean());
                    Assert.True(results.RootElement.GetProperty("smoke-pack").GetProperty("success").GetBoolean());
                    if (!editor)
                    {
                        await core.ExecuteScriptAsync("window.chrome.webview.postMessage(JSON.stringify({id:'smoke-verify',action:'verifySource',payload:{configXml:'<unitRevision><unitWeight>42</unitWeight></unitRevision>'}}));");
                        for (int attempt = 0; attempt < 100; attempt++)
                        {
                            if (await core.ExecuteScriptAsync("Boolean(window.__smokeResponses['smoke-verify'])") == "true") break;
                            await Task.Delay(100);
                        }
                        using var verified = JsonDocument.Parse(await core.ExecuteScriptAsync("window.__smokeResponses['smoke-verify']"));
                        Assert.False(verified.RootElement.GetProperty("success").GetBoolean(), "verifySource must be rejected as unknown action by production bridge handler");
                        Assert.Contains("Unknown bridge action", verified.RootElement.GetProperty("error").GetString());
                    }
                    Assert.Empty(assetFailures);
                    completion.TrySetResult();
                }
                catch (Exception error) { completion.TrySetException(error); }
                finally { form.Close(); }
            };
            Application.Run(form);
        })
        { IsBackground = true, Name = "WebView2 host smoke" };
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        await completion.Task.WaitAsync(TimeSpan.FromSeconds(45));
        Assert.True(thread.Join(TimeSpan.FromSeconds(5)), "WebView2 test message loop did not exit.");
    }
}
