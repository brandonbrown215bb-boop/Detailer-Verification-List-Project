import type { DvlProjectFile, Fact, SpecialQuote, ChecklistInstance, NormalizedXmlGraph, RuleDefinition, UpzBundle } from '../types/index.ts';
import { exportToExcel } from './excelExporter.ts';
import { saveDvlToFile } from './projectStorage.ts';
import { RULES_CATALOG, RULE_PACK_IDENTITY } from './rulesCatalog.ts';

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage: (message: any) => void;
        addEventListener: (event: string, handler: (e: any) => void) => void;
        removeEventListener: (event: string, handler: (e: any) => void) => void;
      };
    };
  }
}

export interface BridgeResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface INativeBridge {
  isDesktopHost(): boolean;
  isRunningInDesktop(): boolean;
  getAppInfo(): Promise<{ appName: string; appVersion: string; rulePackVersion: string; ruleCount: number; isDesktopHost: boolean }>;
  openFileDialog(): Promise<{
    fileName: string;
    filePath: string;
    content: string;
    isDvl: boolean;
    isUpz?: boolean;
    bundle?: UpzBundle;
  } | null>;
  extractUpz(filePath: string): Promise<{
    fileName: string;
    filePath: string;
    content: string;
    isDvl: boolean;
    isUpz: boolean;
    bundle: UpzBundle;
  }>;
  saveDvl(filePath: string, project: DvlProjectFile): Promise<{ saved: boolean; path: string }>;
  saveFileDialog(defaultName: string): Promise<string | null>;
  exportExcelDeliverable(
    facts: Record<string, Fact>,
    sqItems: SpecialQuote[],
    checklists: ChecklistInstance[],
    rules: RuleDefinition[],
    graph?: NormalizedXmlGraph,
    generalComments?: string,
    defaultName?: string,
    isDraft?: boolean
  ): Promise<{ exported: boolean; filePath?: string; fileName?: string; cancelled?: boolean }>;
  openFile(filePath: string): Promise<void>;
  showInExplorer(filePath: string): Promise<void>;
  checkRulePackUpdate(remotePath: string): Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    remoteVersion: string;
    remoteBundleSha256: string;
    remoteRuleCount: number;
    error?: string;
  }>;
  syncRulePack(remotePath: string): Promise<{
    success: boolean;
    version: string;
    bundleSha256?: string;
    ruleCount: number;
    rules?: RuleDefinition[];
    templateMap?: any;
    approvedMappings?: any;
    manifest?: any;
  }>;
  getRulePack(): Promise<{
    rules: RuleDefinition[];
    templateMap: any;
    approvedMappings: any;
    manifest: any;
  }>;
  selectFolderDialog(): Promise<string | null>;
  publishRulePack(payload: any): Promise<{ success: boolean; bundleSha256?: string; error?: string }>;
  launchRuleEditor(): Promise<{ success: boolean; error?: string; path?: string; url?: string }>;
  resolveRulePackLocation(configuredPath?: string): Promise<{
    path: string | null;
    isAutoDetected: boolean;
    sourceType: string;
  }>;
  checkAppUpdate(): Promise<{
    isInstalled: boolean;
    hasUpdate: boolean;
    currentVersion?: string;
    remoteVersion?: string;
    error?: string;
  }>;
  downloadAppUpdate(): Promise<{ success: boolean }>;
  applyAppUpdate(): Promise<void>;
}

export function isDesktopHost(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.chrome &&
    window.chrome.webview &&
    typeof window.chrome.webview.postMessage === 'function' &&
    typeof window.chrome.webview.addEventListener === 'function'
  );
}

/**
 * Production Native Desktop Bridge implementation for Microsoft Edge WebView2 host.
 */
export class WebView2DesktopBridge implements INativeBridge {
  private pendingRequests = new Map<string, { resolve: (data: any) => void; reject: (err: any) => void }>();

  constructor() {
    if (isDesktopHost()) {
      window.chrome!.webview!.addEventListener('message', this.handleMessage.bind(this));
    }
  }

  public isDesktopHost(): boolean {
    return true;
  }

  public isRunningInDesktop(): boolean {
    return true;
  }

  private handleMessage(event: any) {
    try {
      const response: BridgeResponse = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (response && response.id && this.pendingRequests.has(response.id)) {
        const { resolve, reject } = this.pendingRequests.get(response.id)!;
        this.pendingRequests.delete(response.id);

        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Desktop bridge request failed.'));
        }
      }
    } catch (err) {
      console.error('Failed to handle bridge message:', err);
    }
  }

  public sendRequest<T = any>(action: string, payload: any = {}): Promise<T> {
    if (!isDesktopHost()) {
      return Promise.reject(new Error('Not running in WebView2 desktop host.'));
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      window.chrome!.webview!.postMessage(JSON.stringify({ id, action, payload }));

      // 30 second timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Desktop bridge request '${action}' timed out.`));
        }
      }, 30000);
    });
  }

  public async getAppInfo(): Promise<{ appName: string; appVersion: string; rulePackVersion: string; ruleCount: number; isDesktopHost: boolean }> {
    return this.sendRequest('getAppInfo');
  }

  public async openFileDialog(): Promise<{
    fileName: string;
    filePath: string;
    content: string;
    isDvl: boolean;
    isUpz?: boolean;
    bundle?: UpzBundle;
  } | null> {
    return this.sendRequest('openFileDialog');
  }

  public async extractUpz(filePath: string): Promise<{
    fileName: string;
    filePath: string;
    content: string;
    isDvl: boolean;
    isUpz: boolean;
    bundle: UpzBundle;
  }> {
    return this.sendRequest('extractUpz', { filePath });
  }

  public async saveDvl(filePath: string, project: DvlProjectFile): Promise<{ saved: boolean; path: string }> {
    return this.sendRequest('saveDvl', { filePath, projectJson: JSON.stringify(project, null, 2) });
  }

  public async saveFileDialog(defaultName: string): Promise<string | null> {
    return this.sendRequest('saveFileDialog', {
      defaultName,
      filter: 'DVL Project (*.dvl)|*.dvl'
    });
  }

  public async exportExcelDeliverable(
    facts: Record<string, Fact>,
    sqItems: SpecialQuote[],
    checklists: ChecklistInstance[],
    rules: RuleDefinition[],
    graph?: NormalizedXmlGraph,
    generalComments: string = '',
    defaultName?: string,
    isDraft: boolean = false
  ): Promise<{ exported: boolean; filePath?: string; fileName?: string; cancelled?: boolean }> {
    return this.sendRequest('exportExcelDeliverable', {
      facts,
      sqItems,
      checklists,
      rules,
      graph,
      generalComments,
      defaultName,
      isDraft
    });
  }

  public async openFile(filePath: string): Promise<void> {
    await this.sendRequest('openFile', { filePath });
  }

  public async showInExplorer(filePath: string): Promise<void> {
    await this.sendRequest('showInExplorer', { filePath });
  }

  public async checkRulePackUpdate(remotePath: string): Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    remoteVersion: string;
    remoteBundleSha256: string;
    remoteRuleCount: number;
    error?: string;
  }> {
    return this.sendRequest('checkRulePackUpdate', { remotePath });
  }

  public async syncRulePack(remotePath: string): Promise<{
    success: boolean;
    version: string;
    bundleSha256?: string;
    ruleCount: number;
    rules?: RuleDefinition[];
    templateMap?: any;
    approvedMappings?: any;
    manifest?: any;
  }> {
    return this.sendRequest('syncRulePack', { remotePath });
  }

  public async getRulePack(): Promise<{
    rules: RuleDefinition[];
    templateMap: any;
    approvedMappings: any;
    manifest: any;
  }> {
    return this.sendRequest('getRulePack');
  }

  public async selectFolderDialog(): Promise<string | null> {
    const res = await this.sendRequest<{ folderPath: string }>('selectFolderDialog');
    return res?.folderPath || null;
  }

  public async publishRulePack(payload: any): Promise<{ success: boolean; bundleSha256?: string; error?: string }> {
    return this.sendRequest('publishRulePack', payload);
  }

  public async launchRuleEditor(): Promise<{ success: boolean; error?: string; path?: string; url?: string }> {
    return this.sendRequest('launchRuleEditor');
  }

  public async resolveRulePackLocation(configuredPath?: string): Promise<{
    path: string | null;
    isAutoDetected: boolean;
    sourceType: string;
  }> {
    return this.sendRequest('resolveRulePackLocation', { configuredPath });
  }

  public async checkAppUpdate(): Promise<{
    isInstalled: boolean;
    hasUpdate: boolean;
    currentVersion?: string;
    remoteVersion?: string;
    error?: string;
  }> {
    return this.sendRequest('checkAppUpdate');
  }

  public async downloadAppUpdate(): Promise<{ success: boolean }> {
    return this.sendRequest('downloadAppUpdate');
  }

  public async applyAppUpdate(): Promise<void> {
    await this.sendRequest('applyAppUpdate');
  }
}

/**
 * Browser Preview Bridge implementation for standalone web preview / development mode.
 */
export class BrowserPreviewBridge implements INativeBridge {
  public isDesktopHost(): boolean {
    return false;
  }

  public isRunningInDesktop(): boolean {
    return false;
  }

  public async getAppInfo(): Promise<{ appName: string; appVersion: string; rulePackVersion: string; ruleCount: number; isDesktopHost: boolean }> {
    return {
      appName: 'AHU Detailing Verification',
      appVersion: '1.0.0 (Browser Preview)',
      rulePackVersion: RULE_PACK_IDENTITY.version,
      ruleCount: RULES_CATALOG.length,
      isDesktopHost: false
    };
  }

  public async openFileDialog(): Promise<{
    fileName: string;
    filePath: string;
    content: string;
    isDvl: boolean;
    isUpz?: boolean;
    bundle?: UpzBundle;
  } | null> {
    return null;
  }

  public async extractUpz(_filePath: string): Promise<{
    fileName: string;
    filePath: string;
    content: string;
    isDvl: boolean;
    isUpz: boolean;
    bundle: UpzBundle;
  }> {
    throw new Error('UPZ decompression requires Microsoft Windows desktop host with Apprentice COM binaries.');
  }

  public async saveDvl(_filePath: string, project: DvlProjectFile): Promise<{ saved: boolean; path: string }> {
    saveDvlToFile(project);
    return { saved: true, path: `${project.jobName}_${project.comNumber}.dvl` };
  }

  public async saveFileDialog(_defaultName: string): Promise<string | null> {
    return null;
  }

  public async exportExcelDeliverable(
    facts: Record<string, Fact>,
    sqItems: SpecialQuote[],
    checklists: ChecklistInstance[],
    rules: RuleDefinition[],
    graph?: NormalizedXmlGraph,
    _generalComments: string = '',
    defaultName?: string,
    isDraft: boolean = false
  ): Promise<{ exported: boolean; filePath?: string; fileName?: string; cancelled?: boolean }> {
    try {
      exportToExcel(facts, sqItems, checklists, rules, graph, defaultName, isDraft);
      return { exported: true, fileName: defaultName || 'Detailing_Verification_List.xlsx' };
    } catch (err: any) {
      console.error('Browser export error:', err);
      throw new Error(`Failed to generate Excel deliverable: ${err?.message || err}`);
    }
  }

  public async openFile(_filePath: string): Promise<void> {
    console.warn('Native openFile is only available in desktop host.');
  }

  public async showInExplorer(_filePath: string): Promise<void> {
    console.warn('Native showInExplorer is only available in desktop host.');
  }

  public async checkRulePackUpdate(_remotePath: string): Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    remoteVersion: string;
    remoteBundleSha256: string;
    remoteRuleCount: number;
    error?: string;
  }> {
    return {
      hasUpdate: false,
      currentVersion: RULE_PACK_IDENTITY.version,
      remoteVersion: RULE_PACK_IDENTITY.version,
      remoteBundleSha256: RULE_PACK_IDENTITY.sha256,
      remoteRuleCount: RULES_CATALOG.length
    };
  }

  public async syncRulePack(_remotePath: string): Promise<{
    success: boolean;
    version: string;
    bundleSha256?: string;
    ruleCount: number;
    rules?: RuleDefinition[];
    templateMap?: any;
    approvedMappings?: any;
    manifest?: any;
  }> {
    return {
      success: true,
      version: RULE_PACK_IDENTITY.version,
      bundleSha256: RULE_PACK_IDENTITY.sha256,
      ruleCount: RULES_CATALOG.length,
      rules: RULES_CATALOG
    };
  }

  public async getRulePack(): Promise<{
    rules: RuleDefinition[];
    templateMap: any;
    approvedMappings: any;
    manifest: any;
  }> {
    return {
      rules: RULES_CATALOG,
      templateMap: null,
      approvedMappings: null,
      manifest: null
    };
  }

  public async selectFolderDialog(): Promise<string | null> {
    return null;
  }

  public async publishRulePack(_payload: any): Promise<{ success: boolean; bundleSha256?: string; error?: string }> {
    return { success: true };
  }

  public async launchRuleEditor(): Promise<{ success: boolean; error?: string; path?: string; url?: string }> {
    try {
      const win = window.open('/rule-editor.html', '_blank');
      if (!win) {
        throw new Error('Popup window was blocked by browser. Please allow popups for this site.');
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to open Rule Editor window.' };
    }
  }

  public async resolveRulePackLocation(_configuredPath?: string): Promise<{
    path: string | null;
    isAutoDetected: boolean;
    sourceType: string;
  }> {
    return { path: null, isAutoDetected: false, sourceType: 'None' };
  }

  public async checkAppUpdate(): Promise<{
    isInstalled: boolean;
    hasUpdate: boolean;
    currentVersion?: string;
    remoteVersion?: string;
    error?: string;
  }> {
    return { isInstalled: false, hasUpdate: false, currentVersion: 'web' };
  }

  public async downloadAppUpdate(): Promise<{ success: boolean }> {
    return { success: false };
  }

  public async applyAppUpdate(): Promise<void> {
    console.warn('App update restart is only available in desktop host.');
  }
}

/**
 * Unified DesktopBridge coordinator delegating to either WebView2DesktopBridge or BrowserPreviewBridge.
 */
export class DesktopBridge implements INativeBridge {
  private activeBridge: INativeBridge;

  constructor() {
    if (isDesktopHost()) {
      this.activeBridge = new WebView2DesktopBridge();
    } else {
      this.activeBridge = new BrowserPreviewBridge();
    }
  }

  public isDesktopHost(): boolean {
    return this.activeBridge.isDesktopHost();
  }

  public isRunningInDesktop(): boolean {
    return this.activeBridge.isRunningInDesktop();
  }

  public sendRequest<T = any>(action: string, payload: any = {}): Promise<T> {
    if (this.activeBridge instanceof WebView2DesktopBridge) {
      return this.activeBridge.sendRequest<T>(action, payload);
    }
    return Promise.reject(new Error(`Not running in WebView2 desktop host (action: '${action}').`));
  }

  public async getAppInfo() {
    return this.activeBridge.getAppInfo();
  }

  public async openFileDialog() {
    return this.activeBridge.openFileDialog();
  }

  public async extractUpz(filePath: string) {
    return this.activeBridge.extractUpz(filePath);
  }

  public async saveDvl(filePath: string, project: DvlProjectFile) {
    return this.activeBridge.saveDvl(filePath, project);
  }

  public async saveFileDialog(defaultName: string) {
    return this.activeBridge.saveFileDialog(defaultName);
  }

  public async exportExcelDeliverable(
    facts: Record<string, Fact>,
    sqItems: SpecialQuote[],
    checklists: ChecklistInstance[],
    rules: RuleDefinition[],
    graph?: NormalizedXmlGraph,
    generalComments: string = '',
    defaultName?: string,
    isDraft: boolean = false
  ) {
    return this.activeBridge.exportExcelDeliverable(facts, sqItems, checklists, rules, graph, generalComments, defaultName, isDraft);
  }

  public async openFile(filePath: string) {
    return this.activeBridge.openFile(filePath);
  }

  public async showInExplorer(filePath: string) {
    return this.activeBridge.showInExplorer(filePath);
  }

  public async checkRulePackUpdate(remotePath: string) {
    return this.activeBridge.checkRulePackUpdate(remotePath);
  }

  public async syncRulePack(remotePath: string) {
    return this.activeBridge.syncRulePack(remotePath);
  }

  public async getRulePack() {
    return this.activeBridge.getRulePack();
  }

  public async selectFolderDialog() {
    return this.activeBridge.selectFolderDialog();
  }

  public async publishRulePack(payload: any) {
    return this.activeBridge.publishRulePack(payload);
  }

  public async launchRuleEditor(): Promise<{ success: boolean; error?: string; path?: string; url?: string }> {
    if (this.isRunningInDesktop()) {
      return this.sendRequest('launchRuleEditor');
    }
    try {
      const win = window.open('/rule-editor.html', '_blank');
      if (!win) {
        throw new Error('Popup window was blocked by browser. Please allow popups for this site.');
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to open Rule Editor window.' };
    }
  }

  public async resolveRulePackLocation(configuredPath?: string) {
    return this.activeBridge.resolveRulePackLocation(configuredPath);
  }

  public async checkAppUpdate() {
    return this.activeBridge.checkAppUpdate();
  }

  public async downloadAppUpdate() {
    return this.activeBridge.downloadAppUpdate();
  }

  public async applyAppUpdate() {
    return this.activeBridge.applyAppUpdate();
  }
}

export const desktopBridge = new DesktopBridge();
