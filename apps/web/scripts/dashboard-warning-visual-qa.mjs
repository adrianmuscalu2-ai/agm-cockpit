import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const assetRoot = resolve('public/assets/dashboard-warnings');
const outputRoot = resolve('visual-qa/dashboard-warnings');
const assets = [
  ['WL-000', 'wl-000-scope.svg'], ['WL-001', 'wl-001-stop.svg'],
  ['WL-002', 'wl-002-brake.svg'], ['WL-003', 'wl-003-abs.svg'],
  ['WL-004', 'wl-004-oil.svg'], ['WL-005', 'wl-005-coolant.svg'],
  ['WL-006', 'wl-006-charge.svg'], ['WL-007', 'wl-007-engine.svg'],
  ['WL-008', 'wl-008-fuel.svg'], ['WL-009', 'wl-009-adblue.svg'],
  ['WL-010', 'wl-010-dpf.svg'],
];

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1320, height: 1120 }, deviceScaleFactor: 1 });
const encodedAssets = await Promise.all(assets.map(async ([id, file]) => [
  id,
  `data:image/svg+xml;base64,${(await readFile(resolve(assetRoot, file))).toString('base64')}`,
]));
const cards = encodedAssets.map(([id, source]) => `
  <article><h2>${id}</h2>${[96, 64, 48].map((size) => `
    <figure><img src="${source}" width="${size}" height="${size}" alt="${id} at ${size}px"><figcaption>${size}px</figcaption></figure>`).join('')}</article>`).join('');
await page.setContent(`<!doctype html><html lang="ro"><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{margin:0;padding:28px;background:#050b14;color:#e2e8f0;font:14px Arial,sans-serif}
  h1{margin:0 0 22px;color:#7dd3fc} main{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  article{min-height:230px;padding:16px;border:1px solid #24415f;border-radius:16px;background:#091523;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
  h2{width:100%;margin:0;color:#93c5fd;font-size:15px} figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}
  img{display:block} figcaption{color:#94a3b8;font-size:12px}
</style><body><h1>AGM — Dashboard warning assets — visual QA</h1><main>${cards}</main></body></html>`);
await page.screenshot({ path: resolve(outputRoot, 'contact-sheet-dark.png'), fullPage: true });
await browser.close();
console.log(`Visual QA sheet: ${resolve(outputRoot, 'contact-sheet-dark.png')}`);
