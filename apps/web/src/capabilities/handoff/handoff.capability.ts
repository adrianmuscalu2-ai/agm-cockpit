export const handoffCapabilityMatrix = [
  {
    platform: 'browser',
    adapter: 'browser-handoff',
    permissions: [],
    emailAttachments: false,
    controlledShare: 'web-share-when-supported',
  },
  {
    platform: 'android',
    adapter: 'agm-email-plugin',
    permissions: [],
    emailAttachments: true,
    controlledShare: 'android-chooser',
  },
] as const;

