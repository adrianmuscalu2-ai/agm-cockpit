export const diagnosticsCapabilityMatrix = [
  {
    platform: 'browser',
    adapter: 'browser-diagnostics',
    permissions: [],
    permissionMode: 'none',
    fallback: 'safe-browser-payload',
  },
  {
    platform: 'android',
    adapter: 'agm-diagnostics-plugin',
    permissions: ['android.permission.ACCESS_NETWORK_STATE'],
    permissionMode: 'install-time-normal',
    fallback: 'propagate-to-existing-safe-report-fallback',
  },
] as const;
