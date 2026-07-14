import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agm.cockpit',
  appName: 'A.G.M. Cockpit',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    // Internal LAN testing uses an HTTP API. Replace this with HTTPS before production release.
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
