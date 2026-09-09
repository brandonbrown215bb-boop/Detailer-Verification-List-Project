import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Exact Tailwind brand gradient: from-cyan-600 (#0891b2) via-blue-600 (#2563eb) to-indigo-700 (#4338ca)
// Lucide Snowflake SVG icon paths with crisp cyan-100 / white coloring
function createSvg(size) {
  // Padding for desktop/taskbar icons: ~6% margin so Windows doesn't clip squircle corners
  const pad = Math.round(size * 0.05);
  const boxSize = size - pad * 2;
  const radius = Math.round(boxSize * 0.22);
  const strokeWidth = Math.max(1.5, Math.round(size * 0.04));

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0891b2" />
      <stop offset="50%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#4338ca" />
    </linearGradient>
    <filter id="subtleShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${Math.max(1, Math.round(size * 0.025))}" stdDeviation="${Math.max(1, Math.round(size * 0.035))}" flood-color="#0f172a" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Squircle container -->
  <rect x="${pad}" y="${pad}" width="${boxSize}" height="${boxSize}" rx="${radius}" ry="${radius}" fill="url(#bgGrad)" filter="url(#subtleShadow)" />
  <!-- Subtle inner border highlight -->
  <rect x="${pad + 0.5}" y="${pad + 0.5}" width="${boxSize - 1}" height="${boxSize - 1}" rx="${radius - 0.5}" ry="${radius - 0.5}" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1" />

  <!-- Lucide Snowflake (viewBox 0 0 24 24 mapped to center 50% of the box) -->
  <g transform="translate(${size / 2}, ${size / 2}) scale(${(boxSize * 0.56) / 24}) translate(-12, -12)">
    <g fill="none" stroke="#ecfeff" stroke-width="${(strokeWidth * 24) / (boxSize * 0.56)}" stroke-linecap="round" stroke-linejoin="round">
      <path d="m10 20-1.25-2.5L6 18" />
      <path d="M10 4 8.75 6.5 6 6" />
      <path d="m14 20 1.25-2.5L18 18" />
      <path d="m14 4 1.25 2.5L18 6" />
      <path d="m17 21-3-6h-4" />
      <path d="m17 3-3 6 1.5 3" />
      <path d="M2 12h6.5L10 9" />
      <path d="m20 10-1.5 2 1.5 2" />
      <path d="M22 12h-6.5L14 15" />
      <path d="m4 10 1.5 2L4 14" />
      <path d="m7 21 3-6-1.5-3" />
      <path d="m7 3 3 6h4" />
    </g>
  </g>
</svg>
`;
}

function buildIco(images) {
  // images: array of { size, buffer }
  const count = images.length;
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + count * entrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);     // Reserved
  header.writeUInt16LE(1, 2);     // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Image count

  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0); // Width
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1); // Height
    entry.writeUInt8(0, 2);                               // Color count
    entry.writeUInt8(0, 3);                               // Reserved
    entry.writeUInt16LE(1, 4);                            // Color planes
    entry.writeUInt16LE(32, 6);                           // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8);            // Image size
    entry.writeUInt32LE(offset, 12);                      // Offset
    entries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...images.map(img => img.buffer)]);
}

async function main() {
  console.log('[1/4] Launching Chromium to render snowflake icon assets...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const renderedImages = [];

  for (const size of icoSizes) {
    const svg = createSvg(size);
    const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;}body{background:transparent;overflow:hidden;}</style></head><body>${svg}</body></html>`;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html);
    const buffer = await page.screenshot({ omitBackground: true });
    renderedImages.push({ size, buffer });
  }

  // Also render 512x512 master
  const svg512 = createSvg(512);
  const html512 = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;}body{background:transparent;overflow:hidden;}</style></head><body>${svg512}</body></html>`;
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(html512);
  const master512Buffer = await page.screenshot({ omitBackground: true });

  await browser.close();

  console.log('[2/4] Assembling multi-resolution Windows ICO (16x16 to 256x256)...');
  const icoBuffer = buildIco(renderedImages);

  console.log('[3/4] Writing icon files to project locations...');
  const publicDir = path.join(repoRoot, 'public');
  const resourcesDir = path.join(repoRoot, 'resources');
  const appProjectDir = path.join(repoRoot, 'src', 'backend', 'AHUVerification.App');
  const ruleEditorProjectDir = path.join(repoRoot, 'src', 'backend', 'AHUVerification.RuleEditor');

  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.mkdirSync(appProjectDir, { recursive: true });
  fs.mkdirSync(ruleEditorProjectDir, { recursive: true });

  // 512x512 PNGs
  const publicPng = path.join(publicDir, 'snowflake-512x512.png');
  const resourcesPng = path.join(resourcesDir, 'snowflake-512x512.png');
  fs.writeFileSync(publicPng, master512Buffer);
  fs.writeFileSync(resourcesPng, master512Buffer);

  // ICO files
  const appIco = path.join(appProjectDir, 'app.ico');
  const ruleEditorIco = path.join(ruleEditorProjectDir, 'app.ico');
  const resourcesIco = path.join(resourcesDir, 'app.ico');
  const publicFavicon = path.join(publicDir, 'favicon.ico');
  fs.writeFileSync(appIco, icoBuffer);
  fs.writeFileSync(ruleEditorIco, icoBuffer);
  fs.writeFileSync(resourcesIco, icoBuffer);
  fs.writeFileSync(publicFavicon, icoBuffer);

  console.log('[4/4] Icon generation complete:');
  console.log('  - ' + publicPng);
  console.log('  - ' + resourcesPng);
  console.log('  - ' + appIco + ' (' + icoBuffer.length + ' bytes)');
  console.log('  - ' + resourcesIco);
  console.log('  - ' + publicFavicon);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
