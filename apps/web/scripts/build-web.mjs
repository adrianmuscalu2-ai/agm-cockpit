import { build } from 'vite';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createWebBuildDefinition } from '../web-build-definition.mjs';

await build({
  configFile: false,
  ...createWebBuildDefinition(),
});

const distRoot = path.resolve(process.cwd(), 'dist');
await inlineApplicationStyles(distRoot);

if (process.env.CF_PAGES === '1') {
  const downloads = path.resolve(distRoot, 'downloads');
  if (!downloads.startsWith(`${distRoot}${path.sep}`)) throw new Error('PAGES_DOWNLOADS_PATH_OUTSIDE_DIST');
  await rm(downloads, { recursive: true, force: true });
  console.log('Cloudflare Pages assets prepared: release download binaries excluded.');
}

async function inlineApplicationStyles(outputRoot) {
  const indexPath = path.join(outputRoot, 'index.html');
  const assetsPath = path.join(outputRoot, 'assets');
  let html = await readFile(indexPath, 'utf8');
  const linkedStyles = [...html.matchAll(/<link\s+rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g)].map((match) => ({
    tag: match[0],
    href: match[1],
  }));
  const assetNames = await readdir(assetsPath);
  const additionalStyles = assetNames
    .filter((name) => /^load-safety-.+\.css$/.test(name))
    .map((name) => `/assets/${name}`);
  const styleHrefs = [...new Set([...linkedStyles.map(({ href }) => href), ...additionalStyles])];

  for (const href of styleHrefs) {
    const relativeAsset = href.replace(/^\//, '');
    const cssPath = path.resolve(outputRoot, relativeAsset);
    if (!cssPath.startsWith(`${outputRoot}${path.sep}`)) throw new Error('INLINE_CSS_PATH_OUTSIDE_DIST');
    const css = await readFile(cssPath, 'utf8');
    if (css.includes('</style')) throw new Error(`INLINE_CSS_UNSAFE_STYLE_CLOSE:${href}`);
    const marker = `<style data-agm-inline-css="${path.basename(href)}">${css}</style>`;
    const linkedStyle = linkedStyles.find((entry) => entry.href === href);
    html = linkedStyle ? html.replace(linkedStyle.tag, marker) : html.replace('</head>', `    ${marker}\n  </head>`);
  }

  if (/<link\s+rel="stylesheet"/i.test(html)) throw new Error('INLINE_CSS_EXTERNAL_LINK_REMAINS');
  if (!html.includes('data-agm-inline-css=')) throw new Error('INLINE_CSS_MARKER_MISSING');
  await writeFile(indexPath, html, 'utf8');
  console.log(`Application CSS inlined: ${styleHrefs.map((href) => path.basename(href)).join(', ')}`);
}
