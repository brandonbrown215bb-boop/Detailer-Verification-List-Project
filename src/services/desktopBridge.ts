import type { DvlProjectFile, Fact, SpecialQuote, ChecklistInstance, NormalizedXmlGraph, RuleDefinition, UpzBundle } from '../types/index.ts';
import { saveDvlToFile } from './projectStorage.ts';
import { RULES_CATALOG, RULE_PACK_IDENTITY } from './rulesCatalog.ts';
import { EFFECTIVE_APPLICATION_VERSION } from './version.ts';
import type { ProjectSessionSnapshot, SessionCommandResult, BatchOverrideFactsPayload, ReorderSpecialQuotesPayload } from '../types/session.ts';
export * from '../types/session.ts';

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
  verifySource(configXml: string, orderRevXml?: string, manifestXml?: string, manualOverrides?: Record<string, Fact>, sqItems?: SpecialQuote[], existingChecklists?: ChecklistInstance[]): Promise<any>;
  saveFileDialog(defaultName: string): Promise<string | null>;
  exportExcelDeliverable(
    facts: Record<string, Fact>,
    sqItems: SpecialQuote[],
    checklists: ChecklistInstance[],
    rules: RuleDefinition[],
    graph?: NormalizedXmlGraph,
    generalComments?: string,
    defaultName?: string,
    isDraft?: boolean,
    configXml?: string,
    orderRevXml?: string,
    manifestXml?: string
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
  downloadAppUpdate(): Promise<{ success: boolean; error?: string }>;
  applyAppUpdate(): Promise<void>;
  projectSessionOpen(payload: {
    filePath?: string;
    configXml?: string;
    orderRevXml?: string;
    manifestXml?: string;
    isUpz?: boolean;
    isTrusted?: boolean;
    initialOverrides?: Record<string, Fact>;
    initialChecklists?: ChecklistInstance[];
    initialSpecialQuotes?: SpecialQuote[];
    initialGeneralComments?: string;
  }): Promise<ProjectSessionSnapshot>;
  projectSessionGetSnapshot(): Promise<ProjectSessionSnapshot>;
  projectSessionOverrideFact(payload: {
    sessionId: string;
    expectedRevision: number;
    factId: string;
    value: any;
    comment?: string;
    author?: string;
  }): Promise<SessionCommandResult>;
  projectSessionBatchOverrideFacts(payload: BatchOverrideFactsPayload): Promise<SessionCommandResult>;
  projectSessionRevertFact(payload: {
    sessionId: string;
    expectedRevision: number;
    factId: string;
  }): Promise<SessionCommandResult>;
  projectSessionUpdateChecklist(payload: {
    sessionId: string;
    expectedRevision: number;
    checkId: string;
    status: string;
    comment?: string;
    detailerInitials?: string;
  }): Promise<SessionCommandResult>;
  projectSessionUpdateSpecialQuote(payload: {
    sessionId: string;
    expectedRevision: number;
    specialQuote: SpecialQuote;
  }): Promise<SessionCommandResult>;
  projectSessionDeleteSpecialQuote(payload: {
    sessionId: string;
    expectedRevision: number;
    quoteId: string;
  }): Promise<SessionCommandResult>;
  projectSessionReorderSpecialQuotes(payload: ReorderSpecialQuotesPayload): Promise<SessionCommandResult>;
  projectSessionUpdateGeneralComments(payload: {
    sessionId: string;
    expectedRevision: number;
    comments: string;
  }): Promise<SessionCommandResult>;
  projectSessionReset(payload: {
    sessionId: string;
    expectedRevision: number;
  }): Promise<SessionCommandResult>;
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

  public async verifySource(configXml: string, orderRevXml?: string, manifestXml?: string, manualOverrides?: Record<string, Fact>, sqItems?: SpecialQuote[], existingChecklists?: ChecklistInstance[]): Promise<any> {
    return this.sendRequest('verifySource', { configXml, orderRevXml, manifestXml, manualOverrides, sqItems, existingChecklists });
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
    isDraft: boolean = false,
    configXml?: string,
    orderRevXml?: string,
    manifestXml?: string
  ): Promise<{ exported: boolean; filePath?: string; fileName?: string; cancelled?: boolean }> {
    return this.sendRequest('exportExcelDeliverable', {
      facts,
      sqItems,
      checklists,
      rules,
      graph,
      generalComments,
      defaultName,
      isDraft,
      configXml,
      orderRevXml,
      manifestXml
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

  public async downloadAppUpdate(): Promise<{ success: boolean; error?: string }> {
    return this.sendRequest('downloadAppUpdate');
  }

  public async applyAppUpdate(): Promise<void> {
    await this.sendRequest('applyAppUpdate');
  }

  public async projectSessionOpen(payload: any): Promise<ProjectSessionSnapshot> {
    return this.sendRequest('projectSession_open', payload);
  }

  public async projectSessionGetSnapshot(): Promise<ProjectSessionSnapshot> {
    return this.sendRequest('projectSession_getSnapshot');
  }

  public async projectSessionOverrideFact(payload: any): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_overrideFact', payload);
  }

  public async projectSessionBatchOverrideFacts(payload: any): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_batchOverrideFacts', payload);
  }

  public async projectSessionRevertFact(payload: any): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_revertFact', payload);
  }

  public async projectSessionUpdateChecklist(payload: any): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_updateChecklist', payload);
  }

  public async projectSessionUpdateSpecialQuote(payload: any): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_updateSpecialQuote', payload);
  }

  public async projectSessionDeleteSpecialQuote(payload: any): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_deleteSpecialQuote', payload);
  }

  public async projectSessionReorderSpecialQuotes(payload: any): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_reorderSpecialQuotes', payload);
  }

  public async projectSessionUpdateGeneralComments(payload: any): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_updateGeneralComments', payload);
  }

  public async projectSessionReset(payload: any): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_reset', payload);
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
      appVersion: `${EFFECTIVE_APPLICATION_VERSION} (Browser Preview)`,
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

  public async verifySource(configXml: string, orderRevXml?: string, manifestXml?: string, manualOverrides?: Record<string, Fact>, sqItems?: SpecialQuote[], existingChecklists?: ChecklistInstance[]): Promise<any> {
    throw new Error('verifySource requires Microsoft Windows desktop host');
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
    isDraft: boolean = false,
    _configXml?: string,
    _orderRevXml?: string,
    _manifestXml?: string
  ): Promise<{ exported: boolean; filePath?: string; fileName?: string; cancelled?: boolean }> {
    try {
      const { exportToExcel } = await import('./excelExporter.ts');
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
    return { success: false, error: 'Publishing is only available when running in the desktop Rule Editor application.' };
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

  public async downloadAppUpdate(): Promise<{ success: boolean; error?: string }> {
    return { success: false };
  }

  public async applyAppUpdate(): Promise<void> {
    console.warn('App update restart is only available in desktop host.');
  }

  public async projectSessionOpen(_payload: any): Promise<ProjectSessionSnapshot> {
    throw new Error('ProjectSession requires desktop host.');
  }

  public async projectSessionGetSnapshot(): Promise<ProjectSessionSnapshot> {
    throw new Error('ProjectSession requires desktop host.');
  }

  public async projectSessionOverrideFact(_payload: any): Promise<SessionCommandResult> {
    throw new Error('ProjectSession requires desktop host.');
  }

  public async projectSessionBatchOverrideFacts(_payload: any): Promise<SessionCommandResult> {
    throw new Error('ProjectSession requires desktop host.');
  }

  public async projectSessionRevertFact(_payload: any): Promise<SessionCommandResult> {
    throw new Error('ProjectSession requires desktop host.');
  }

  public async projectSessionUpdateChecklist(_payload: any): Promise<SessionCommandResult> {
    throw new Error('ProjectSession requires desktop host.');
  }

  public async projectSessionUpdateSpecialQuote(_payload: any): Promise<SessionCommandResult> {
    throw new Error('ProjectSession requires desktop host.');
  }

  public async projectSessionDeleteSpecialQuote(_payload: any): Promise<SessionCommandResult> {
    throw new Error('ProjectSession requires desktop host.');
  }

  public async projectSessionReorderSpecialQuotes(_payload: any): Promise<SessionCommandResult> {
    throw new Error('ProjectSession requires desktop host.');
  }

  public async projectSessionUpdateGeneralComments(_payload: any): Promise<SessionCommandResult> {
    throw new Error('ProjectSession requires desktop host.');
  }

  public async projectSessionReset(_payload: any): Promise<SessionCommandResult> {
    throw new Error('ProjectSession requires desktop host.');
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

  public async verifySource(configXml: string, orderRevXml?: string, manifestXml?: string, manualOverrides?: Record<string, Fact>, sqItems?: SpecialQuote[], existingChecklists?: ChecklistInstance[]) {
    return this.activeBridge.verifySource(configXml, orderRevXml, manifestXml, manualOverrides, sqItems, existingChecklists);
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
    isDraft: boolean = false,
    configXml?: string,
    orderRevXml?: string,
    manifestXml?: string
  ) {
    return this.activeBridge.exportExcelDeliverable(facts, sqItems, checklists, rules, graph, generalComments, defaultName, isDraft, configXml, orderRevXml, manifestXml);
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

  public async projectSessionOpen(payload: any) {
    return this.activeBridge.projectSessionOpen(payload);
  }

  public async projectSessionGetSnapshot() {
    return this.activeBridge.projectSessionGetSnapshot();
  }

  public async projectSessionOverrideFact(payload: any) {
    return this.activeBridge.projectSessionOverrideFact(payload);
  }

  public async projectSessionBatchOverrideFacts(payload: any) {
    return this.activeBridge.projectSessionBatchOverrideFacts(payload);
  }

  public async projectSessionRevertFact(payload: any) {
    return this.activeBridge.projectSessionRevertFact(payload);
  }

  public async projectSessionUpdateChecklist(payload: any) {
    return this.activeBridge.projectSessionUpdateChecklist(payload);
  }

  public async projectSessionUpdateSpecialQuote(payload: any) {
    return this.activeBridge.projectSessionUpdateSpecialQuote(payload);
  }

  public async projectSessionDeleteSpecialQuote(payload: any) {
    return this.activeBridge.projectSessionDeleteSpecialQuote(payload);
  }

  public async projectSessionReorderSpecialQuotes(payload: any) {
    return this.activeBridge.projectSessionReorderSpecialQuotes(payload);
  }

  public async projectSessionUpdateGeneralComments(payload: any) {
    return this.activeBridge.projectSessionUpdateGeneralComments(payload);
  }

  public async projectSessionReset(payload: any) {
    return this.activeBridge.projectSessionReset(payload);
  }
}

export const desktopBridge = new DesktopBridge();
