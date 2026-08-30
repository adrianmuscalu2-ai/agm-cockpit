import type { CapacitorConfig } from '@capacitor/cli';

const allowLanHttp = process.env.AGM_ALLOW_LAN_HTTP_BUILD === 'true';

const config: CapacitorConfig = {
  appId: 'com.agm.cockpit',
  appName: 'AGM Transporte',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: allowLanHttp,
  },
  server: {
    // Isolate packaged assets from the public website Service Worker scope.
    hostname: 'localhost',
    androidScheme: allowLanHttp ? 'http' : 'https',
  },
};

export default config;
