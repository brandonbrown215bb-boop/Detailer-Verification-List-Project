import type { DvlProjectFile, Fact, SpecialQuote, ChecklistInstance, NormalizedXmlGraph, RuleDefinition, UpzBundle } from '../types/index.ts';
import type {
  ProjectSessionSnapshot,
  SessionCommandResult,
  ProjectSessionOpenPayload,
  OverrideFactPayload,
  BatchOverrideFactsPayload,
  RevertFactPayload,
  UpdateChecklistPayload,
  UpdateSpecialQuotePayload,
  DeleteSpecialQuotePayload,
  ReorderSpecialQuotesPayload,
  UpdateGeneralCommentsPayload,
  ResetSessionPayload,
  CreateManualProjectCommand,
  SegmentTemplate,
  SaveProjectPayload,
  SaveProjectResult,
  OpenDvlPayload,
  ExportExcelPayload,
  ExportExcelResult,
  RecoveryInfo
} from '../types/session.ts';
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
    sourceHandle?: string;
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
  saveFileDialog(defaultName: string): Promise<string | null>;
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
  validateRulePack(payload: any): Promise<{ isValid: boolean; errors?: any[]; templateMap?: any; error?: string }>;
  saveDraft(payload: any): Promise<{ success: boolean; filePath?: string; fileName?: string; templateMap?: any; cancelled?: boolean; error?: string; errors?: any[] }>;
  openDraft(filePath?: string): Promise<{ success: boolean; filePath?: string; fileName?: string; rules?: RuleDefinition[]; templateMap?: any; approvedMappings?: any; manifest?: any; cancelled?: boolean; error?: string; errors?: any[] }>;
  evaluateRuleSandbox(payload: { rule: any; simulatedValues: Record<string, any> }): Promise<{ isValid: boolean; result: boolean; needsInput: boolean; trace: string; error?: string }>;
  reloadActiveRulePack(): Promise<any>;
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
  projectSessionOpen(payload: ProjectSessionOpenPayload): Promise<ProjectSessionSnapshot>;
  projectSessionGetSnapshot(): Promise<ProjectSessionSnapshot>;
  projectSessionOverrideFact(payload: OverrideFactPayload): Promise<SessionCommandResult>;
  projectSessionBatchOverrideFacts(payload: BatchOverrideFactsPayload): Promise<SessionCommandResult>;
  projectSessionRevertFact(payload: RevertFactPayload): Promise<SessionCommandResult>;
  projectSessionUpdateChecklist(payload: UpdateChecklistPayload): Promise<SessionCommandResult>;
  projectSessionUpdateSpecialQuote(payload: UpdateSpecialQuotePayload): Promise<SessionCommandResult>;
  projectSessionDeleteSpecialQuote(payload: DeleteSpecialQuotePayload): Promise<SessionCommandResult>;
  projectSessionReorderSpecialQuotes(payload: ReorderSpecialQuotesPayload): Promise<SessionCommandResult>;
  projectSessionUpdateGeneralComments(payload: UpdateGeneralCommentsPayload): Promise<SessionCommandResult>;
  projectSessionReset(payload: ResetSessionPayload): Promise<SessionCommandResult>;
  projectSessionCreateManual(payload: CreateManualProjectCommand): Promise<ProjectSessionSnapshot>;
  getSegmentTemplates(): Promise<SegmentTemplate[]>;
  projectSessionSave(payload: SaveProjectPayload): Promise<SaveProjectResult>;
  projectSessionOpenDvl(payload: OpenDvlPayload): Promise<ProjectSessionSnapshot>;
  projectSessionExportExcel(payload: ExportExcelPayload): Promise<ExportExcelResult>;
  getRecoveryInfo(): Promise<RecoveryInfo>;
  restoreRecovery(): Promise<ProjectSessionSnapshot>;
  discardRecovery(): Promise<{ success: boolean }>;
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
  private isListening = false;

  constructor() {
    this.ensureMessageListener();
  }

  private ensureMessageListener() {
    if (!this.isListening && isDesktopHost()) {
      window.chrome!.webview!.addEventListener('message', this.handleMessage.bind(this));
      this.isListening = true;
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

    this.ensureMessageListener();

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
    sourceHandle?: string;
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

  public async saveFileDialog(defaultName: string): Promise<string | null> {
    return this.sendRequest('saveFileDialog', {
      defaultName,
      filter: 'DVL Project (*.dvl)|*.dvl'
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

  public async publishRulePack(payload: any): Promise<{ success: boolean; bundleSha256?: string; version?: string; totalRules?: number; error?: string; errors?: any[] }> {
    return this.sendRequest('publishRulePack', payload);
  }

  public async validateRulePack(payload: any): Promise<{ isValid: boolean; valid?: boolean; errors?: any[]; templateMap?: any; rules?: RuleDefinition[]; error?: string }> {
    return this.sendRequest('validateRulePack', payload);
  }

  public async saveDraft(payload: any): Promise<{ success: boolean; filePath?: string; fileName?: string; templateMap?: any; rules?: RuleDefinition[]; manifest?: any; cancelled?: boolean; error?: string; errors?: any[] }> {
    return this.sendRequest('saveDraft', payload);
  }

  public async openDraft(filePath?: string): Promise<{ success: boolean; filePath?: string; fileName?: string; rules?: RuleDefinition[]; templateMap?: any; approvedMappings?: any; manifest?: any; cancelled?: boolean; error?: string; errors?: any[] }> {
    return this.sendRequest('openDraft', { filePath });
  }

  public async evaluateRuleSandbox(payload: { rule: any; simulatedValues: Record<string, any> }): Promise<{ isValid: boolean; result: boolean; needsInput: boolean; trace: string; error?: string }> {
    return this.sendRequest('evaluateRuleSandbox', payload);
  }

  public async reloadActiveRulePack(): Promise<any> {
    return this.sendRequest('reloadActiveRulePack');
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

  public async projectSessionOpen(payload: ProjectSessionOpenPayload): Promise<ProjectSessionSnapshot> {
    return this.sendRequest('projectSession_open', payload);
  }

  public async projectSessionGetSnapshot(): Promise<ProjectSessionSnapshot> {
    return this.sendRequest('projectSession_getSnapshot');
  }

  public async projectSessionOverrideFact(payload: OverrideFactPayload): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_overrideFact', payload);
  }

  public async projectSessionBatchOverrideFacts(payload: BatchOverrideFactsPayload): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_batchOverrideFacts', payload);
  }

  public async projectSessionRevertFact(payload: RevertFactPayload): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_revertFact', payload);
  }

  public async projectSessionUpdateChecklist(payload: UpdateChecklistPayload): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_updateChecklist', payload);
  }

  public async projectSessionUpdateSpecialQuote(payload: UpdateSpecialQuotePayload): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_updateSpecialQuote', payload);
  }

  public async projectSessionDeleteSpecialQuote(payload: DeleteSpecialQuotePayload): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_deleteSpecialQuote', payload);
  }

  public async projectSessionReorderSpecialQuotes(payload: ReorderSpecialQuotesPayload): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_reorderSpecialQuotes', payload);
  }

  public async projectSessionUpdateGeneralComments(payload: UpdateGeneralCommentsPayload): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_updateGeneralComments', payload);
  }

  public async projectSessionReset(payload: ResetSessionPayload): Promise<SessionCommandResult> {
    return this.sendRequest('projectSession_reset', payload);
  }

  public async projectSessionCreateManual(payload: CreateManualProjectCommand): Promise<ProjectSessionSnapshot> {
    return this.sendRequest('projectSession_createManual', payload);
  }

  public async getSegmentTemplates(): Promise<SegmentTemplate[]> {
    return this.sendRequest('getSegmentTemplates');
  }

  public async projectSessionSave(payload: SaveProjectPayload): Promise<SaveProjectResult> {
    return this.sendRequest('projectSession_save', payload);
  }

  public async projectSessionOpenDvl(payload: OpenDvlPayload): Promise<ProjectSessionSnapshot> {
    return this.sendRequest('projectSession_openDvl', payload);
  }

  public async projectSessionExportExcel(payload: ExportExcelPayload): Promise<ExportExcelResult> {
    return this.sendRequest('projectSession_exportExcel', payload);
  }

  public async getRecoveryInfo(): Promise<RecoveryInfo> {
    return this.sendRequest('getRecoveryInfo');
  }

  public async restoreRecovery(): Promise<ProjectSessionSnapshot> {
    return this.sendRequest('restoreRecovery');
  }

  public async discardRecovery(): Promise<{ success: boolean }> {
    return this.sendRequest('discardRecovery');
  }
}

/**
 * Unified DesktopBridge coordinator targeting Microsoft Edge WebView2 desktop host.
 */
export class DesktopBridge implements INativeBridge {
  private activeBridge: WebView2DesktopBridge;

  constructor() {
    this.activeBridge = new WebView2DesktopBridge();
  }

  public isDesktopHost(): boolean {
    return isDesktopHost();
  }

  public isRunningInDesktop(): boolean {
    return isDesktopHost();
  }

  public sendRequest<T = any>(action: string, payload: any = {}): Promise<T> {
    if (!isDesktopHost()) {
      return Promise.reject(new Error(`Not running in WebView2 desktop host (action: '${action}').`));
    }
    return this.activeBridge.sendRequest<T>(action, payload);
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

  public async saveFileDialog(defaultName: string) {
    return this.activeBridge.saveFileDialog(defaultName);
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

  public async validateRulePack(payload: any) {
    return this.activeBridge.validateRulePack(payload);
  }

  public async saveDraft(payload: any) {
    return this.activeBridge.saveDraft(payload);
  }

  public async openDraft(filePath?: string) {
    return this.activeBridge.openDraft(filePath);
  }

  public async evaluateRuleSandbox(payload: { rule: any; simulatedValues: Record<string, any> }) {
    return this.activeBridge.evaluateRuleSandbox(payload);
  }

  public async reloadActiveRulePack() {
    return this.activeBridge.reloadActiveRulePack();
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

  public async projectSessionOpen(payload: ProjectSessionOpenPayload) {
    return this.activeBridge.projectSessionOpen(payload);
  }

  public async projectSessionGetSnapshot() {
    return this.activeBridge.projectSessionGetSnapshot();
  }

  public async projectSessionOverrideFact(payload: OverrideFactPayload) {
    return this.activeBridge.projectSessionOverrideFact(payload);
  }

  public async projectSessionBatchOverrideFacts(payload: BatchOverrideFactsPayload) {
    return this.activeBridge.projectSessionBatchOverrideFacts(payload);
  }

  public async projectSessionRevertFact(payload: RevertFactPayload) {
    return this.activeBridge.projectSessionRevertFact(payload);
  }

  public async projectSessionUpdateChecklist(payload: UpdateChecklistPayload) {
    return this.activeBridge.projectSessionUpdateChecklist(payload);
  }

  public async projectSessionUpdateSpecialQuote(payload: UpdateSpecialQuotePayload) {
    return this.activeBridge.projectSessionUpdateSpecialQuote(payload);
  }

  public async projectSessionDeleteSpecialQuote(payload: DeleteSpecialQuotePayload) {
    return this.activeBridge.projectSessionDeleteSpecialQuote(payload);
  }

  public async projectSessionReorderSpecialQuotes(payload: ReorderSpecialQuotesPayload) {
    return this.activeBridge.projectSessionReorderSpecialQuotes(payload);
  }

  public async projectSessionUpdateGeneralComments(payload: UpdateGeneralCommentsPayload) {
    return this.activeBridge.projectSessionUpdateGeneralComments(payload);
  }

  public async projectSessionReset(payload: ResetSessionPayload) {
    return this.activeBridge.projectSessionReset(payload);
  }

  public async projectSessionCreateManual(payload: CreateManualProjectCommand) {
    return this.activeBridge.projectSessionCreateManual(payload);
  }

  public async getSegmentTemplates() {
    return this.activeBridge.getSegmentTemplates();
  }

  public async projectSessionSave(payload: SaveProjectPayload) {
    return this.activeBridge.projectSessionSave(payload);
  }

  public async projectSessionOpenDvl(payload: OpenDvlPayload) {
    return this.activeBridge.projectSessionOpenDvl(payload);
  }

  public async projectSessionExportExcel(payload: ExportExcelPayload) {
    return this.activeBridge.projectSessionExportExcel(payload);
  }

  public async getRecoveryInfo() {
    return this.activeBridge.getRecoveryInfo();
  }

  public async restoreRecovery() {
    return this.activeBridge.restoreRecovery();
  }

  public async discardRecovery() {
    return this.activeBridge.discardRecovery();
  }
}

export const desktopBridge = new DesktopBridge();
