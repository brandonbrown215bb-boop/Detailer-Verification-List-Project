import { DvlProjectFile, Fact, SpecialQuote, ChecklistInstance, NormalizedXmlGraph, RuleDefinition, UpzBundle } from '../types';
import { exportToExcel } from './excelExporter';
import { saveDvlToFile } from './projectStorage';
import { RULES_CATALOG, RULE_PACK_IDENTITY } from './rulesCatalog';

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

interface BridgeResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

class DesktopBridge {
  private isDesktop = false;
  private pendingRequests = new Map<string, { resolve: (data: any) => void; reject: (err: any) => void }>();

  constructor() {
    if (typeof window !== 'undefined' && window.chrome?.webview) {
      this.isDesktop = true;
      window.chrome.webview.addEventListener('message', this.handleMessage.bind(this));
    }
  }

  public isRunningInDesktop(): boolean {
    return this.isDesktop;
  }

  private handleMessage(event: any) {
    const response: BridgeResponse = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (response.id && this.pendingRequests.has(response.id)) {
      const { resolve, reject } = this.pendingRequests.get(response.id)!;
      this.pendingRequests.delete(response.id);

      if (response.success) {
        resolve(response.data);
      } else {
        reject(new Error(response.error || 'Desktop bridge request failed.'));
      }
    }
  }

  private sendRequest<T = any>(action: string, payload: any = {}): Promise<T> {
    if (!this.isDesktop || !window.chrome?.webview) {
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

  // --- API Methods ---

  public async getAppInfo(): Promise<{ appName: string; appVersion: string; rulePackVersion: string; ruleCount: number; isDesktopHost: boolean }> {
    if (this.isDesktop) {
      return this.sendRequest('getAppInfo');
    }
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
    if (this.isDesktop) {
      return this.sendRequest('openFileDialog');
    }
    return null;
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
    if (this.isDesktop) {
      return this.sendRequest('saveDvl', { filePath, projectJson: JSON.stringify(project, null, 2) });
    }
    saveDvlToFile(project);
    return { saved: true, path: `${project.jobName}_${project.comNumber}.dvl` };
  }

  public async saveFileDialog(defaultName: string): Promise<string | null> {
    if (this.isDesktop) {
      return this.sendRequest('saveFileDialog', {
        defaultName,
        filter: 'DVL Project (*.dvl)|*.dvl'
      });
    }
    return null;
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
    if (this.isDesktop) {
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

    // Browser fallback
    exportToExcel(facts, sqItems, checklists, rules, graph, defaultName, isDraft);
    return { exported: true, fileName: defaultName || 'Detailing_Verification_List.xlsx' };
  }

  public async openFile(filePath: string): Promise<void> {
    if (this.isDesktop) {
      await this.sendRequest('openFile', { filePath });
    }
  }

  public async showInExplorer(filePath: string): Promise<void> {
    if (this.isDesktop) {
      await this.sendRequest('showInExplorer', { filePath });
    }
  }

  public async syncRulePack(remotePath: string): Promise<{ success: boolean; version: string; ruleCount: number }> {
    if (this.isDesktop) {
      return this.sendRequest('syncRulePack', { remotePath });
    }
    return { success: true, version: RULE_PACK_IDENTITY.version, ruleCount: RULES_CATALOG.length };
  }
}

export const desktopBridge = new DesktopBridge();
