import { useCallback, useEffect, useRef, useState } from 'react';
import type { RuleDefinition, RulePackIdentity } from '../types';
import { desktopBridge } from '../services/desktopBridge';
import {
  activeRulePackArtifactsFrom,
  identityFromRulePack,
  type ActiveRulePackArtifacts,
  type RulePackPayload
} from '../orchestration/projectSession';

const DEFAULT_RULE_PACK_IDENTITY: RulePackIdentity = {
  version: '0.0.0',
  sha256: ''
};

export interface AppUpdateNotice {
  message: string;
  canRestart?: boolean;
}

export interface UseRulePackSessionResult {
  activeRules: RuleDefinition[];
  rulePackIdentity: RulePackIdentity;
  activeRulePackArtifacts: ActiveRulePackArtifacts;
  centralRulePackPath: string;
  setCentralRulePackPath: (path: string) => void;
  rulePackNotice: string | null;
  dismissRulePackNotice: () => void;
  appUpdateNotice: AppUpdateNotice | null;
  dismissAppUpdateNotice: () => void;
  applyAppUpdate: () => Promise<void>;
  handleRulePackUpdated: (updatedBundle: RulePackPayload) => void;
  rulePackError: string | null;
}

export function useRulePackSession(): UseRulePackSessionResult {
  const [activeRules, setActiveRules] = useState<RuleDefinition[]>([]);
  const [rulePackIdentity, setRulePackIdentity] = useState<RulePackIdentity>(DEFAULT_RULE_PACK_IDENTITY);
  const [activeRulePackArtifacts, setActiveRulePackArtifacts] = useState<ActiveRulePackArtifacts>({});
  const [centralRulePackPath, setCentralRulePackPath] = useState<string>(() => {
    return localStorage.getItem('dvl_central_rulepack_path') || '';
  });
  const [rulePackNotice, setRulePackNotice] = useState<string | null>(null);
  const [rulePackError, setRulePackError] = useState<string | null>(null);
  const [appUpdateNotice, setAppUpdateNotice] = useState<AppUpdateNotice | null>(null);
  const packLoadRevision = useRef(0);
  const activeHostGeneration = useRef(-1);

  useEffect(() => {
    if (!desktopBridge.isRunningInDesktop()) return;
    let cancelled = false;
    const packRequest = ++packLoadRevision.current;

    const applyPack = (pack: RulePackPayload | undefined) => {
      if (!pack?.rules?.length || cancelled || packRequest !== packLoadRevision.current) return;
      if (typeof pack.generation === 'number') {
        if (pack.generation < activeHostGeneration.current) return;
        activeHostGeneration.current = pack.generation;
      }
      setActiveRules(pack.rules as RuleDefinition[]);
      setActiveRulePackArtifacts(activeRulePackArtifactsFrom(pack));
      setRulePackIdentity(identityFromRulePack(pack, DEFAULT_RULE_PACK_IDENTITY));
    };

    const loadAndSync = async () => {
      // These operations are intentionally ordered. A slower initial read must
      // never overwrite a newer pack accepted by synchronization.
      try {
        const pack = await desktopBridge.getRulePack();
        if ((pack as any)?.success === false || (pack as any)?.error) {
          setRulePackError((pack as any).error || 'Failed to load rule pack from desktop host.');
          return;
        }
        if (!pack?.rules?.length) {
          setRulePackError('Active rule pack contains no valid rules.');
          return;
        }
        setRulePackError(null);
        applyPack(pack);
      } catch (err: any) {
        console.warn('Failed to load initial rule pack from bridge:', err);
        setRulePackError(err?.message || 'Failed to load rule pack from desktop host.');
        return;
      }

      const configuredPath = localStorage.getItem('dvl_central_rulepack_path');
      const autoSync = localStorage.getItem('dvl_auto_sync_rulepack') !== 'false';
      try {
        const resolved = await desktopBridge.resolveRulePackLocation(configuredPath || undefined);
        if (!cancelled && resolved.path && autoSync) {
          const updateInfo = await desktopBridge.checkRulePackUpdate(resolved.path);
          if (!cancelled && updateInfo.hasUpdate && !updateInfo.error) {
            const syncResult = await desktopBridge.syncRulePack(resolved.path);
            if (!cancelled && syncResult.success && syncResult.rules) {
              applyPack(syncResult);
              const origin = resolved.isAutoDetected
                ? (resolved.sourceType === 'NetworkShare' ? 'network share' : 'SharePoint sync')
                : 'central path';
              setRulePackNotice(`Rule Pack auto-updated to v${syncResult.version} (${syncResult.ruleCount} active rules) from ${origin}`);
            }
          }
        }
      } catch (err) {
        console.warn('Rule pack auto-sync check failed:', err);
      }
    };

    void loadAndSync();

    // Check for Velopack desktop app updates independently of pack ordering.
    void desktopBridge.checkAppUpdate().then(async appUpdate => {
      if (cancelled || !appUpdate.hasUpdate || !appUpdate.remoteVersion) return;
      setAppUpdateNotice({
        message: `New desktop app v${appUpdate.remoteVersion} detected. Downloading in background...`,
        canRestart: false
      });
      try {
        const downloaded = await desktopBridge.downloadAppUpdate();
        if (cancelled) return;
        setAppUpdateNotice(downloaded.success
          ? { message: `App update v${appUpdate.remoteVersion} is ready to apply.`, canRestart: true }
          : { message: `Failed to download desktop app update v${appUpdate.remoteVersion}${downloaded.error ? `: ${downloaded.error}` : '.'}`, canRestart: false });
      } catch (dlErr: any) {
        if (!cancelled) setAppUpdateNotice({
          message: `Failed to download desktop app update v${appUpdate.remoteVersion}: ${dlErr?.message || 'Network error'}`,
          canRestart: false
        });
      }
    }).catch(err => console.warn('Desktop app update check failed:', err));

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRulePackUpdated = useCallback((updatedBundle: RulePackPayload) => {
    if (!updatedBundle?.rules?.length) return;
    if (typeof updatedBundle.generation === 'number') {
      if (updatedBundle.generation < activeHostGeneration.current) return;
      activeHostGeneration.current = updatedBundle.generation;
    }
    ++packLoadRevision.current;
    const nextRules = updatedBundle.rules as RuleDefinition[];
    const nextIdentity = identityFromRulePack(updatedBundle, rulePackIdentity);
    setActiveRules(nextRules);
    setActiveRulePackArtifacts(activeRulePackArtifactsFrom(updatedBundle));
    setRulePackIdentity(nextIdentity);
    setRulePackNotice(`Rule Pack updated to v${nextIdentity.version} (${updatedBundle.ruleCount || nextRules.filter(r => !r.isArchived).length} active rules)`);
  }, [rulePackIdentity]);

  const dismissRulePackNotice = useCallback(() => setRulePackNotice(null), []);
  const dismissAppUpdateNotice = useCallback(() => setAppUpdateNotice(null), []);
  const applyAppUpdate = useCallback(() => desktopBridge.applyAppUpdate(), []);

  return {
    activeRules,
    rulePackIdentity,
    activeRulePackArtifacts,
    centralRulePackPath,
    setCentralRulePackPath,
    rulePackNotice,
    dismissRulePackNotice,
    appUpdateNotice,
    dismissAppUpdateNotice,
    applyAppUpdate,
    handleRulePackUpdated,
    rulePackError
  };
}
