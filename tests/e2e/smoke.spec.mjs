import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

// Load static rule pack assets for mock desktop bridge
const rules = JSON.parse(fs.readFileSync('resources/rulepack/rules.json', 'utf8'));
const templateMap = JSON.parse(fs.readFileSync('resources/rulepack/template_map.json', 'utf8'));
const approvedMappings = JSON.parse(fs.readFileSync('resources/rulepack/approved_mappings.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('resources/rulepack/manifest.json', 'utf8'));

async function expectNoSeriousA11yViolations(page, include) {
  let builder = new AxeBuilder({ page });
  if (include) builder = builder.include(include);
  const result = await builder.analyze();
  const serious = result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

/**
 * Injects a realistic WebView2 desktop bridge mock into the browser page.
 */
async function injectMockDesktopBridge(page) {
  await page.addInitScript(({ mockPack }) => {
    localStorage.setItem('dvl_detailer_name', 'CI Detailer');
    localStorage.setItem('dvl_theme_mode', 'light');

    const listeners = [];
    window.chrome = {
      webview: {
        postMessage: (jsonStr) => {
          let req;
          try {
            req = JSON.parse(jsonStr);
          } catch {
            return;
          }

          setTimeout(() => {
            let data = null;
            let success = true;
            let error = null;

            if (req.action === 'getAppInfo') {
              data = {
                appName: 'AHU Verification • Desktop Authoritative Engine',
                appVersion: '1.0.0',
                rulePackVersion: mockPack.manifest.version,
                ruleCount: mockPack.rules.length,
                isDesktopHost: true
              };
            } else if (req.action === 'getRulePack') {
              data = mockPack;
            } else if (req.action === 'getRecoveryInfo') {
              data = { hasRecovery: false };
            } else if (req.action === 'checkAppUpdate') {
              data = { isInstalled: true, hasUpdate: false };
            } else if (req.action === 'checkRulePackUpdate') {
              data = { hasUpdate: false, currentVersion: mockPack.manifest.version, remoteVersion: mockPack.manifest.version };
            } else if (req.action === 'resolveRulePackLocation') {
              data = { path: 'resources/rulepack', isAutoDetected: true, sourceType: 'bundled' };
            } else if (req.action === 'getSegmentTemplates') {
              data = [
                { typeCode: 'FAN', name: 'Supply Fan Segment', defaultLength: 48 },
                { typeCode: 'COIL', name: 'Cooling Coil Segment', defaultLength: 36 }
              ];
            } else if (req.action === 'projectSession_getSnapshot') {
              data = {
                sessionRevision: 1,
                sourceIsTrusted: true,
                isReadyForFinal: false,
                rulePackIdentity: { version: mockPack.manifest.version, bundleSha256: mockPack.manifest.bundleSha256 },
                unitReadiness: {
                  unconfirmedFactsCount: 0,
                  blockedChecksCount: 0,
                  incompleteChecksCount: 0,
                  completedChecksCount: 0,
                  naChecksCount: 0,
                  totalApplicableChecksCount: 0,
                  totalChecksCount: 0,
                  percentComplete: 0,
                  isReadyForFinal: false,
                  blockedRules: [],
                  unconfirmedFacts: [],
                  incompleteRules: [],
                  passedRules: [],
                  scopeReadinessMap: {}
                },
                facts: {},
                checklists: [],
                specialQuotes: [],
                comments: ''
              };
            }

            const res = { id: req.id, success, error, data };
            listeners.forEach(fn => fn({ data: JSON.stringify(res) }));
          }, 10);
        },
        addEventListener: (event, handler) => {
          if (event === 'message') listeners.push(handler);
        },
        removeEventListener: (event, handler) => {
          const idx = listeners.indexOf(handler);
          if (idx >= 0) listeners.splice(idx, 1);
        }
      }
    };
  }, { mockPack: { rules, templateMap, approvedMappings, manifest } });
}

test.describe('Standalone Browser Mode (No Desktop Bridge)', () => {
  test('main application renders Desktop Application Required screen', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Desktop Application Required' })).toBeVisible();
    await expect(page.getByText(/requires the official Microsoft Windows desktop host runtime/i)).toBeVisible();
    await expect(page.getByText('Remediation Steps')).toBeVisible();
    await expect(page.getByText('Technical Diagnostics')).toBeVisible();

    await expectNoSeriousA11yViolations(page);
  });

  test('rule editor renders Desktop Application Required screen', async ({ page }) => {
    await page.goto('/rule-editor.html');

    await expect(page.getByRole('heading', { name: 'Desktop Application Required' })).toBeVisible();
    await expect(page.getByText(/requires the official Microsoft Windows desktop host runtime/i)).toBeVisible();

    await expectNoSeriousA11yViolations(page);
  });

  test('desktop required screen diagnostics can be copied', async ({ page }) => {
    await page.goto('/');

    const copyBtn = page.getByRole('button', { name: /Copy Diagnostics/i });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(page.getByText(/Copied to Clipboard/i)).toBeVisible();
  });

  test('narrow viewport remains horizontally contained on desktop required screen', async ({ page }) => {
    await page.goto('/');

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});

test.describe('Desktop Host Environment (Mock Bridge)', () => {
  test('home screen renders core launch options without console errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await injectMockDesktopBridge(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Select an AHU Project to Begin Verification' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Import Config\.xml \/ \.upz/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open \.dvl Project/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Manual Unit Setup/ })).toBeVisible();
    await expect(page.getByText(/Rule Pack v/)).toBeVisible();

    expect(pageErrors).toEqual([]);
    await expectNoSeriousA11yViolations(page);
  });

  test('manual unit modal behaves as a real accessible dialog with focus management', async ({ page }) => {
    await injectMockDesktopBridge(page);
    await page.goto('/');

    const trigger = page.getByRole('button', { name: /Manual Unit Setup/ });
    await expect(trigger).toBeVisible({ timeout: 10000 });
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-labelledby', /.+/);
    await expect(page.locator('#root')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#root')).toHaveAttribute('inert', '');

    // Focus is trapped inside the dialog
    const activeInsideDialog = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      return !!dialogEl && !!document.activeElement && dialogEl.contains(document.activeElement);
    });
    expect(activeInsideDialog).toBe(true);

    // Axe accessibility check on dialog
    await expectNoSeriousA11yViolations(page, '[role="dialog"]');
    await dialog.getByRole('button', { name: 'Next Step' }).click();
    await expect(dialog.getByText(/Shipping Skids & Base Structure/i)).toBeVisible();
    await expectNoSeriousA11yViolations(page, '[role="dialog"]');

    // Escape key closes modal cleanly
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#root')).not.toHaveAttribute('inert');
    await expect(trigger).toBeFocused();
  });

  test('rule editor renders rule list and active pack version under desktop host', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await injectMockDesktopBridge(page);
    await page.goto('/rule-editor.html');

    // Expect Rule Editor header and rule list to be loaded
    await expect(page.getByText(new RegExp(`v${manifest.version}`))).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Save Draft/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open Draft/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Publish Release/i })).toBeVisible();

    expect(pageErrors).toEqual([]);
    await expectNoSeriousA11yViolations(page);
  });
});
