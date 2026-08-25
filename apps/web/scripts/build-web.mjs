import { build } from 'vite';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { createWebBuildDefinition } from '../web-build-definition.mjs';

await build({
  configFile: false,
  ...createWebBuildDefinition(),
});

if (process.env.CF_PAGES === '1') {
  const distRoot = path.resolve(process.cwd(), 'dist');
  const downloads = path.resolve(distRoot, 'downloads');
  if (!downloads.startsWith(`${distRoot}${path.sep}`)) throw new Error('PAGES_DOWNLOADS_PATH_OUTSIDE_DIST');
  await rm(downloads, { recursive: true, force: true });
  console.log('Cloudflare Pages assets prepared: release download binaries excluded.');
}
