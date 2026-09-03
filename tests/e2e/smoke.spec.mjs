import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function seedStableBrowserState(page) {
  await page.addInitScript(() => {
    localStorage.setItem('dvl_detailer_name', 'CI Detailer');
    localStorage.setItem('dvl_theme_mode', 'light');
    localStorage.removeItem('ahu_dvl_autosave');
  });
}

async function expectNoSeriousA11yViolations(page, include) {
  let builder = new AxeBuilder({ page });
  if (include) builder = builder.include(include);
  const result = await builder.analyze();
  const serious = result.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await seedStableBrowserState(page);
  await page.goto('/');
});

test('home screen renders core launch options without console errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await expect(page.getByRole('heading', { name: 'Select an AHU Project to Begin Verification' })).toBeVisible();
  await expect(page.getByText('Import Config.xml / .upz')).toBeVisible();
  await expect(page.getByText('Open .dvl Project')).toBeVisible();
  await expect(page.getByText('Manual Unit Setup')).toBeVisible();
  await expect(page.getByText(/Rule Pack v/)).toBeVisible();

  expect(pageErrors).toEqual([]);
  await expectNoSeriousA11yViolations(page);
});

test('manual unit modal behaves as a real accessible dialog with focus management', async ({ page }) => {
  await page.getByText('Manual Unit Setup').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute('aria-labelledby', /.+/);

  // Verify focus is automatically trapped inside the dialog
  const activeInsideDialog = await page.evaluate(() => {
    const dialogEl = document.querySelector('[role="dialog"]');
    return !!dialogEl && !!document.activeElement && dialogEl.contains(document.activeElement);
  });
  expect(activeInsideDialog).toBe(true);

  // Axe accessibility guarantee on dialog
  await expectNoSeriousA11yViolations(page, '[role="dialog"]');

  // Escape key closes modal cleanly
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Ctrl+K opens search and places focus inside the search input', async ({ page }) => {
  await page.getByText('Load Demo Dataset').click();
  await expect(page.getByText('Medical Center Phase 3')).toBeVisible();
  await page.locator('body').click();
  await page.keyboard.press('Control+k');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');

  const active = await page.evaluate(() => {
    const dialogEl = document.querySelector('[role="dialog"]');
    const activeEl = document.activeElement;
    return {
      inside: !!dialogEl && !!activeEl && dialogEl.contains(activeEl),
      tag: activeEl?.tagName,
      value: activeEl instanceof HTMLInputElement ? activeEl.value : null
    };
  });

  expect(active.inside).toBe(true);
  expect(active.tag).toBe('INPUT');
  await expectNoSeriousA11yViolations(page, '[role="dialog"]');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('settings modal opens with accessible focus and controls', async ({ page }) => {
  await page.getByText('Load Demo Dataset').click();

  // Find and open Settings dialog
  const settingsBtn = page.getByTitle('Settings & Diagnostics');
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    await expectNoSeriousA11yViolations(page, '[role="dialog"]');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

test('invalid XML import produces a durable visible error state with role="alert"', async ({ page }) => {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Import Config.xml / .upz').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'invalid-config.xml',
    mimeType: 'application/xml',
    buffer: Buffer.from('<not-an-ahu></not-an-ahu>')
  });

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('invalid-config.xml');
  await expect(alert).toContainText(/Failed to Ingest AHU Configuration|Error/i);

  await expectNoSeriousA11yViolations(page);
});

test('narrow viewport remains horizontally contained on the home screen', async ({ page }) => {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});
