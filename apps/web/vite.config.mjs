import { defineConfig } from 'vite';
import { execFile } from 'node:child_process';
import { createWebBuildDefinition } from './web-build-definition.mjs';

const buildDefinition = createWebBuildDefinition();

export default defineConfig({
  ...buildDefinition,
  plugins: [...(buildDefinition.plugins ?? []), androidTelemetryPlugin()],
  server: {
    watch: {
      ignored: ['**/android/**'],
    },
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/production-api': {
        target: 'https://api.agmcockpit.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/production-api/, ''),
      },
      '/production-app': {
        target: 'https://app.agmcockpit.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/production-app/, '') || '/',
      },
    },
  },
  preview: {
    proxy: {
      '/api/v1': {
        target: 'https://api.agmcockpit.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});

function androidTelemetryPlugin() {
  const middleware = (server) => {
    server.middlewares.use('/__agm/telemetry/android', (_request, response) => {
    const adb = `${process.env.LOCALAPPDATA ?? 'C:\\Users\\adria\\AppData\\Local'}\\Android\\Sdk\\platform-tools\\adb.exe`;
    execFile(adb, ['devices'], { timeout: 4_000, windowsHide: true }, (error, stdout = '') => {
      const devices = stdout.split(/\r?\n/).slice(1).filter((line) => /\tdevice$/.test(line.trim())).length;
      const ready = !error && devices > 0;
      response.statusCode = ready ? 200 : 503;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify({
        contract: 'agm-android-telemetry.v1',
        status: ready ? 'ready' : 'unavailable',
        checkedAt: new Date().toISOString(),
        devices,
        source: 'authorized-local-adb',
      }));
      });
    });
  };
  return { name: 'agm-android-telemetry', configureServer: middleware, configurePreviewServer: middleware };
}
