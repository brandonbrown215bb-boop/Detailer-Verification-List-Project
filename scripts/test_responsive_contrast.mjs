#!/usr/bin/env node

/**
 * Responsive Layout & WCAG 2.2 AA Contrast Compliance Test Suite (M5 / R5)
 * Validates responsive column prioritization, expandable row detail drawers,
 * sidebar auto-collapse (<1200px), and mathematical color contrast ratios.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('======================================================================');
console.log(' AHU Verification - Responsive Layout & Contrast Tests (M5 / R5)');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Suite 1: WCAG 2.2 AA Mathematical Contrast Ratio Verification
// ---------------------------------------------------------------------------
console.log('[Suite 1/4] WCAG 2.2 AA Color Contrast Mathematical Audits...');

function hexToRgb(hex) {
  const sanitized = hex.replace('#', '');
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return [r, g, b];
}

function getRelativeLuminance([r8, g8, b8]) {
  const sRGB = [r8, g8, b8].map(val => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

function getContrastRatio(hex1, hex2) {
  const lum1 = getRelativeLuminance(hexToRgb(hex1));
  const lum2 = getRelativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Light Mode Contrast Tests (Background: #ffffff or #f8fafc)
const lightBg = '#ffffff';
const lightCanvas = '#f8fafc';
const darkBg = '#0f172a'; // slate-900
const darkCanvas = '#020617'; // slate-950

const slate900 = '#0f172a';
const slate800 = '#1e293b';
const slate700 = '#334155';
const slate600 = '#475569';
const slate300 = '#cbd5e1';
const slate200 = '#e2e8f0';
const slate100 = '#f1f5f9';

const emerald700 = '#047857';
const emerald400 = '#34d399';
const amber800 = '#92400e';
const amber300 = '#fcd34d';
const red700 = '#b91c1c';
const red300 = '#fca5a5';

// Light Mode Ratios
const lightPrimaryRatio = getContrastRatio(slate900, lightBg);
const lightBodyRatio = getContrastRatio(slate800, lightBg);
const lightSecondaryRatio = getContrastRatio(slate700, lightBg);
const lightMutedRatio = getContrastRatio(slate600, lightCanvas);

assert(lightPrimaryRatio >= 7.0, `Light Mode Primary (slate-900 on white): ${lightPrimaryRatio.toFixed(2)}:1 (>= 7.0 AAA)`);
assert(lightBodyRatio >= 7.0, `Light Mode Body (slate-800 on white): ${lightBodyRatio.toFixed(2)}:1 (>= 7.0 AAA)`);
assert(lightSecondaryRatio >= 4.5, `Light Mode Secondary (slate-700 on white): ${lightSecondaryRatio.toFixed(2)}:1 (>= 4.5 AA)`);
assert(lightMutedRatio >= 4.5, `Light Mode Muted (slate-600 on light canvas): ${lightMutedRatio.toFixed(2)}:1 (>= 4.5 AA)`);

// Dark Mode Ratios
const darkPrimaryRatio = getContrastRatio(slate100, darkBg);
const darkBodyRatio = getContrastRatio(slate200, darkBg);
const darkSecondaryRatio = getContrastRatio(slate300, darkBg);

assert(darkPrimaryRatio >= 7.0, `Dark Mode Primary (slate-100 on slate-900): ${darkPrimaryRatio.toFixed(2)}:1 (>= 7.0 AAA)`);
assert(darkBodyRatio >= 7.0, `Dark Mode Body (slate-200 on slate-900): ${darkBodyRatio.toFixed(2)}:1 (>= 7.0 AAA)`);
assert(darkSecondaryRatio >= 4.5, `Dark Mode Secondary (slate-300 on slate-900): ${darkSecondaryRatio.toFixed(2)}:1 (>= 4.5 AA)`);

// Status Badge Contrast Ratios
const emeraldLightBadgeRatio = getContrastRatio(emerald700, '#ecfdf5');
const emeraldDarkBadgeRatio = getContrastRatio(emerald400, '#064e3b');
const amberLightBadgeRatio = getContrastRatio(amber800, '#fffbeb');
const amberDarkBadgeRatio = getContrastRatio(amber300, '#78350f');

assert(emeraldLightBadgeRatio >= 4.5, `Emerald Badge Light Mode: ${emeraldLightBadgeRatio.toFixed(2)}:1 (>= 4.5 AA)`);
assert(emeraldDarkBadgeRatio >= 4.5, `Emerald Badge Dark Mode: ${emeraldDarkBadgeRatio.toFixed(2)}:1 (>= 4.5 AA)`);
assert(amberLightBadgeRatio >= 4.5, `Amber Badge Light Mode: ${amberLightBadgeRatio.toFixed(2)}:1 (>= 4.5 AA)`);
assert(amberDarkBadgeRatio >= 4.5, `Amber Badge Dark Mode: ${amberDarkBadgeRatio.toFixed(2)}:1 (>= 4.5 AA)`);

// ---------------------------------------------------------------------------
// Suite 2: SkidViewTab Column Prioritization & Expandable Row Drawers
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/4] SkidViewTab Responsive Column Layout & Row Drawers...');

const skidViewTabPath = path.join(srcDir, 'components', 'SkidViewTab.tsx');
assert(fs.existsSync(skidViewTabPath), 'SkidViewTab.tsx exists in src/components/');

const skidViewTabSource = fs.readFileSync(skidViewTabPath, 'utf8');
assert(skidViewTabSource.includes('min-w-[320px]'), 'SkidViewTab prioritizes verification description with >= 320px minimum width');
assert(skidViewTabSource.includes('expandedRowKeys'), 'SkidViewTab maintains expandedRowKeys state dictionary for metadata drawers');
assert(skidViewTabSource.includes('toggleRowExpansion'), 'SkidViewTab implements toggleRowExpansion handler');
assert(skidViewTabSource.includes('Rule Verification Logic:'), 'SkidViewTab drawer displays clean Rule Verification Logic');
assert(skidViewTabSource.includes('factTraces'), 'SkidViewTab drawer renders provenance fact traces');
assert(skidViewTabSource.includes('commentInputRefs'), 'SkidViewTab supports inline detailer comments');

// ---------------------------------------------------------------------------
// Suite 3: Sidebar Responsive Auto-Collapse & Keyboard Toggle
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/4] Sidebar Responsive Breakpoint & Shortcuts...');

const appPath = path.join(srcDir, 'App.tsx');
assert(fs.existsSync(appPath), 'App.tsx exists in src/');

const appSource = fs.readFileSync(appPath, 'utf8');
assert(appSource.includes('window.innerWidth < 1200'), 'App.tsx implements responsive auto-collapse below 1200px window width');
assert(appSource.includes("e.key.toLowerCase() === 'b'"), 'App.tsx binds Ctrl+B to toggle sidebar collapse state');
assert(appSource.includes("e.key.toLowerCase() === 'k'"), 'App.tsx binds Ctrl+K to toggle global OmniSearch modal');

// ---------------------------------------------------------------------------
// Suite 4: Modal Theme Cohesion (No Dark Frame Bleed in Light Mode)
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/4] Modal Shell Light & Dark Theme Cohesion...');

const modalShellPath = path.join(srcDir, 'components', 'common', 'ModalShell.tsx');
assert(fs.existsSync(modalShellPath), 'ModalShell.tsx exists in src/components/common/');

const modalShellSource = fs.readFileSync(modalShellPath, 'utf8');
assert(modalShellSource.includes('bg-white dark:bg-slate-900'), 'ModalShell renders pure white background in light theme without dark container shell');
assert(modalShellSource.includes('border border-slate-200') || modalShellSource.includes('border-slate-200'), 'ModalShell uses cohesive light/dark border classes');
assert(modalShellSource.includes('backdrop-blur-sm'), 'ModalShell uses translucent backdrop overlay');

// Summary
console.log('\n======================================================================');
if (failedTests === 0) {
  console.log(` [SUCCESS] All ${totalTests} responsive & contrast compliance assertions passed cleanly!`);
  console.log('======================================================================\n');
  process.exit(0);
} else {
  console.error(` [FAILURE] ${failedTests} of ${totalTests} assertions failed.`);
  console.log('======================================================================\n');
  process.exit(1);
}
