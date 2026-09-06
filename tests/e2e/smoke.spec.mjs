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

async function setupLoadedProject(page) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import Config\.xml \/ \.upz/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles('tests/fixtures/Config.xml');

  // If ComNumberModal prompts for missing COM#, fill and save
  const comDialog = page.getByRole('dialog');
  const comInput = comDialog.getByRole('textbox', { name: /COM Number/i });
  if (await comInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await comInput.fill('COM-842910');
    await comDialog.getByRole('button', { name: /Save COM#/i }).click();
  }

  await expect(page.getByRole('button', { name: 'General Unit Specs' })).toBeVisible({ timeout: 10000 });
}

test.beforeEach(async ({ page }) => {
  await seedStableBrowserState(page);
  await page.goto('/');
});

test('home screen renders core launch options without console errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await expect(page.getByRole('heading', { name: 'Select an AHU Project to Begin Verification' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Import Config\.xml \/ \.upz/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open \.dvl Project/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Manual Unit Setup/ })).toBeVisible();
  await expect(page.getByText(/Rule Pack v/)).toBeVisible();

  expect(pageErrors).toEqual([]);
  await expectNoSeriousA11yViolations(page);
});

test('primary launch buttons invoke their native actions', async ({ page }) => {
  const importButton = page.getByRole('button', { name: /Import Config\.xml \/ \.upz/ });
  const openProjectButton = page.getByRole('button', { name: /Open \.dvl Project/ });

  const importChooserPromise = page.waitForEvent('filechooser');
  await importButton.click();
  await importChooserPromise;

  await page.reload();
  const projectChooserPromise = page.waitForEvent('filechooser');
  await openProjectButton.click();
  await projectChooserPromise;

  await page.reload();
  const manualButton = page.getByRole('button', { name: /Manual Unit Setup/ });
  await manualButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  // Verify real fixture import launches the workspace
  await setupLoadedProject(page);
  await expect(page.getByRole('button', { name: 'General Unit Specs' })).toBeVisible();
});

test('manual unit modal behaves as a real accessible dialog with focus management', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /Manual Unit Setup/ });
  await trigger.focus();
  await trigger.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute('aria-labelledby', /.+/);
  await expect(page.locator('#root')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#root')).toHaveAttribute('inert', '');

  // Verify focus is automatically trapped inside the dialog
  const activeInsideDialog = await page.evaluate(() => {
    const dialogEl = document.querySelector('[role="dialog"]');
    return !!dialogEl && !!document.activeElement && dialogEl.contains(document.activeElement);
  });
  expect(activeInsideDialog).toBe(true);

  // Axe accessibility guarantee on dialog Step 1
  await expectNoSeriousA11yViolations(page, '[role="dialog"]');
  await dialog.getByRole('button', { name: 'Next Step' }).click();
  await expect(dialog.getByText(/Shipping Skids & Base Structure/i)).toBeVisible();
  await expectNoSeriousA11yViolations(page, '[role="dialog"]');

  // Verify both edges of the Tab cycle, including Shift+Tab.
  const focusableButtons = dialog.locator('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  const firstFocusable = focusableButtons.first();
  const lastFocusable = focusableButtons.last();
  await firstFocusable.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(lastFocusable).toBeFocused();
  await lastFocusable.focus();
  await page.keyboard.press('Tab');
  await expect(firstFocusable).toBeFocused();

  // Escape key closes modal cleanly
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
  await expect(trigger).toBeFocused();

  // A rapid reopen/close must not retain a stale stack or background isolation.
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Ctrl+K opens search and places focus inside the search input', async ({ page }) => {
  await setupLoadedProject(page);
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
  await setupLoadedProject(page);

  const settingsBtn = page.getByTitle('Open Settings & Preferences');
  await expect(settingsBtn).toBeVisible();
  await settingsBtn.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  // Required settings controls must render in the desktop-compatible browser path.
  await expect(dialog.locator('input[type="text"]').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Check for Updates Now' })).toBeVisible();

  await expectNoSeriousA11yViolations(page, '[role="dialog"]');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('loaded project primary surfaces meet the accessibility contract', async ({ page }) => {
  await setupLoadedProject(page);
  await expectNoSeriousA11yViolations(page);

  const resolutionButton = page.getByTitle(/Facts & Provenance Resolution Center/);
  await expect(resolutionButton).toBeVisible();
  await resolutionButton.click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectNoSeriousA11yViolations(page, '[role="dialog"]');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByTitle('Generate Excel Verification List (.xlsx)').click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectNoSeriousA11yViolations(page, '[role="dialog"]');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByTitle('Open Settings & Preferences').click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectNoSeriousA11yViolations(page, '[role="dialog"]');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.keyboard.press('Control+k');
  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectNoSeriousA11yViolations(page, '[role="dialog"]');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('browser draft export loads the Excel preview bundle on demand', async ({ page }) => {
  await setupLoadedProject(page);

  await page.getByTitle('Generate Excel Verification List (.xlsx)').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export Draft .xlsx' }).click();
  const download = await downloadPromise;

  await expect(dialog).toBeHidden();
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});

test('invalid XML import produces a durable visible error state with role="alert"', async ({ page }) => {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import Config\.xml \/ \.upz/ }).click();
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
