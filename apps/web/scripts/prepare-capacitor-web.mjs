import { rm } from 'node:fs/promises';
import path from 'node:path';

const distRoot = path.resolve(process.cwd(), 'dist');
const downloads = path.resolve(distRoot, 'downloads');
if (!downloads.startsWith(`${distRoot}${path.sep}`)) throw new Error('CAPACITOR_DOWNLOADS_PATH_OUTSIDE_DIST');
await rm(downloads, { recursive: true, force: true });
console.log('Capacitor web assets prepared: public download binaries excluded from packaged APK.');
