import React, { useState } from 'react';
import { RuleDiffItem } from '../types';
import { CheckCircle2, AlertCircle, ArrowRight, Upload, Folder, ShieldCheck, Tag } from 'lucide-react';
import { desktopBridge } from '../../services/desktopBridge';
import { ModalShell } from '../../components/common/ModalShell';

interface PublishModalProps {
  isOpen: boolean;
  currentVersion: string;
  diffs: RuleDiffItem[];
  onClose: () => void;
  onPublish: (newVersion: string, releaseNotes: string, targetPath?: string) => Promise<void>;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  currentVersion,
  diffs,
  onClose,
  onPublish
}) => {
  if (!isOpen) return null;

  // Calculate semantic version suggestions
  const semverParts = currentVersion.split('.').map(p => parseInt(p, 10) || 0);
  const major = semverParts[0] ?? 14;
  const minor = semverParts[1] ?? 0;
  const patch = semverParts[2] ?? 0;

  const patchVer = `${major}.${minor}.${patch + 1}`;
  const minorVer = `${major}.${minor + 1}.0`;
  const majorVer = `${major + 1}.0.0`;

  const [selectedVersion, setSelectedVersion] = useState<string>(minorVer);
  const [customVersion, setCustomVersion] = useState<string>('');
  const [releaseNotes, setReleaseNotes] = useState<string>('');
  const [targetPath, setTargetPath] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveVersion = customVersion.trim() || selectedVersion;

  const handleConfirmPublish = async () => {
    try {
      setIsPublishing(true);
      setError(null);
      await onPublish(effectiveVersion, releaseNotes, targetPath.trim() || undefined);
      setIsPublishing(false);
      onClose();
    } catch (e: any) {
      setIsPublishing(false);
      setError(e.message || 'Publish failed');
    }
  };

  const addedCount = diffs.filter(d => d.changeType === 'added').length;
  const modifiedCount = diffs.filter(d => d.changeType === 'modified').length;
  const archivedCount = diffs.filter(d => d.changeType === 'archived').length;
  const unarchivedCount = diffs.filter(d => d.changeType === 'unarchived').length;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Publish Rule Pack Release"
      subtitle="Review changes, bump version, and calculate canonical bundle SHA-256"
      icon={<ShieldCheck className="w-5 h-5" />}
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-400">
            Publishing as version <strong className="text-emerald-400 font-mono">{effectiveVersion}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPublishing || diffs.length === 0}
              onClick={handleConfirmPublish}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg shadow-lg shadow-emerald-950 transition-all"
            >
              <Upload className="w-4 h-4" />
              {isPublishing ? 'Publishing & Hashing...' : 'Publish Release'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
          {/* Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
              <span className="block text-xl font-bold text-emerald-400">{addedCount}</span>
              <span className="text-[11px] text-slate-400">New Rules Added</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
              <span className="block text-xl font-bold text-blue-400">{modifiedCount}</span>
              <span className="text-[11px] text-slate-400">Rules Modified</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
              <span className="block text-xl font-bold text-amber-400">{archivedCount}</span>
              <span className="text-[11px] text-slate-400">Rules Archived</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
              <span className="block text-xl font-bold text-purple-400">{unarchivedCount}</span>
              <span className="text-[11px] text-slate-400">Rules Restored</span>
            </div>
          </div>

          {/* Detailed Change Diff List */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Visual Change Diff ({diffs.length} total changes)
            </h3>

            {diffs.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800">
                No changes detected. The rule pack is currently identical to the published release.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {diffs.map(diff => (
                  <div
                    key={diff.ruleId}
                    className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-200">{diff.ruleId}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({diff.semanticKey})
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${
                          diff.changeType === 'added'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : diff.changeType === 'modified'
                            ? 'bg-blue-950 text-blue-400 border-blue-800'
                            : diff.changeType === 'archived'
                            ? 'bg-amber-950 text-amber-400 border-amber-800'
                            : 'bg-purple-950 text-purple-400 border-purple-800'
                        }`}
                      >
                        {diff.changeType}
                      </span>
                    </div>

                    {diff.fieldChanges && diff.fieldChanges.length > 0 && (
                      <div className="pl-2 border-l-2 border-slate-800 space-y-1 mt-1">
                        {diff.fieldChanges.map((fc, i) => (
                          <div key={i} className="text-[11px] text-slate-400">
                            <strong className="text-slate-300">{fc.label}:</strong>{' '}
                            <span className="line-through text-red-400/80 mr-1">
                              {typeof fc.beforeVal === 'object' ? JSON.stringify(fc.beforeVal) : String(fc.beforeVal ?? '')}
                            </span>
                            <ArrowRight className="w-3 h-3 inline text-slate-600 mx-1" />
                            <span className="text-emerald-400">
                              {typeof fc.afterVal === 'object' ? JSON.stringify(fc.afterVal) : String(fc.afterVal ?? '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Version Increment Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Release Version
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedVersion(minorVer);
                  setCustomVersion('');
                }}
                className={`p-3 text-left rounded-xl border transition-all ${
                  selectedVersion === minorVer && !customVersion
                    ? 'bg-blue-950/60 border-blue-600 shadow-sm'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200">Minor (Recommended)</span>
                  <span className="font-mono text-xs text-blue-400 font-bold">{minorVer}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  New rules, rule edits, or condition adjustments.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedVersion(patchVer);
                  setCustomVersion('');
                }}
                className={`p-3 text-left rounded-xl border transition-all ${
                  selectedVersion === patchVer && !customVersion
                    ? 'bg-blue-950/60 border-blue-600 shadow-sm'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200">Patch</span>
                  <span className="font-mono text-xs text-blue-400 font-bold">{patchVer}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Typo fixes or reference note tweaks.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedVersion(majorVer);
                  setCustomVersion('');
                }}
                className={`p-3 text-left rounded-xl border transition-all ${
                  selectedVersion === majorVer && !customVersion
                    ? 'bg-blue-950/60 border-blue-600 shadow-sm'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200">Major</span>
                  <span className="font-mono text-xs text-blue-400 font-bold">{majorVer}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Major category or template overhaul.
                </p>
              </button>
            </div>
          </div>

          {/* Release Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
              Release Notes / Changelog
            </label>
            <textarea
              rows={2}
              value={releaseNotes}
              onChange={e => setReleaseNotes(e.target.value)}
              placeholder="e.g. Added BASE-08 for lifting lug guidelines, updated HOUS-03 static pressure logic..."
              className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Target Distribution Path (Optional) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
              Optional Remote Distribution Folder (UNC / SharePoint Sync)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetPath}
                onChange={e => setTargetPath(e.target.value)}
                placeholder="e.g. \\share\Engineering\RulePacks or C:\Users\...\OneDrive\AHU_Rules"
                className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {desktopBridge.isRunningInDesktop() && (
                <button
                  type="button"
                  onClick={async () => {
                    const folder = await desktopBridge.selectFolderDialog();
                    if (folder) setTargetPath(folder);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 flex-shrink-0 transition-colors"
                  title="Browse target folder..."
                >
                  <Folder className="w-3.5 h-3.5" />
                  Browse
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
      </div>
    </ModalShell>
  );
};
