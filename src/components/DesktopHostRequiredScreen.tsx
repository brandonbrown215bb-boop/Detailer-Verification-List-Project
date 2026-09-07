import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, RefreshCw, ShieldAlert, Terminal } from 'lucide-react';

export const DesktopHostRequiredScreen: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const diagnostics = {
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    platform: typeof navigator !== 'undefined' ? (navigator.platform || 'Unknown') : 'Unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
    hasWebView2: typeof window !== 'undefined' && Boolean(window.chrome?.webview),
    status: 'Native desktop bridge unavailable'
  };

  const diagnosticText = JSON.stringify(diagnostics, null, 2);

  const handleCopyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = diagnosticText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 sm:p-10 select-none">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Desktop Application Required
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            AHU Detailing Verification requires the official Microsoft Windows desktop host runtime. Calculations, rule evaluations, and file persistence cannot execute in a standalone browser.
          </p>
        </div>

        <div className="w-full bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 text-left space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Remediation Steps
          </h2>
          <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
            <li>
              <span className="text-slate-200 font-medium">Launch via Windows Shortcut:</span> Start the application using your desktop shortcut or run <code className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px]">AHUVerification.App.exe</code>.
            </li>
            <li>
              <span className="text-slate-200 font-medium">Verify Host Process:</span> Confirm that the desktop background process has not been terminated by Task Manager or security policies.
            </li>
            <li>
              <span className="text-slate-200 font-medium">Contact Support:</span> If you were provided this address as a web link, provide the diagnostic data below to your engineering administrator.
            </li>
          </ol>
        </div>

        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
              <Terminal className="w-3.5 h-3.5" /> Technical Diagnostics
            </span>
            <button
              type="button"
              onClick={handleCopyDiagnostics}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Diagnostics</span>
                </>
              )}
            </button>
          </div>
          <pre
            tabIndex={0}
            aria-label="Technical Diagnostics Log"
            className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3.5 text-[11px] font-mono text-slate-400 text-left overflow-x-auto max-h-32 select-text focus:outline-none focus:ring-1 focus:ring-slate-700"
          >
            {diagnosticText}
          </pre>
        </div>

        <div className="flex items-center gap-3 w-full pt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  );
};
