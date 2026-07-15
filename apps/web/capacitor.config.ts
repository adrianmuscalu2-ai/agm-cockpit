import type { CapacitorConfig } from '@capacitor/cli';

const allowLanHttp = process.env.AGM_ALLOW_LAN_HTTP_BUILD === 'true';

const config: CapacitorConfig = {
  appId: 'com.agm.cockpit',
  appName: 'A.G.M. Cockpit',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: allowLanHttp,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
