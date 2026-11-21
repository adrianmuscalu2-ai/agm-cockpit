export const applicationActions = [
  'OPEN_APP', 'BRING_TO_FOREGROUND', 'OPEN_DEEP_LINK', 'NAVIGATE_TO_DESTINATION',
  'READ_ALLOWED_CONTENT', 'COMPOSE_CONTENT', 'SHARE_CONTENT', 'SEND_CONTENT',
  'START_CALL', 'OPEN_CONTACT', 'MEDIA_PLAY', 'MEDIA_PAUSE', 'MEDIA_NEXT',
  'MEDIA_PREVIOUS', 'SEARCH', 'QUERY_STATUS',
] as const;

export type ApplicationAction = typeof applicationActions[number];
export type ApplicationSafetyClass = 'GENERAL' | 'NAVIGATION' | 'MEDIA' | 'COMMUNICATION' | 'GAME' | 'HARD_BLOCKED';
export type ApplicationAccessState = 'OFF' | 'ON' | 'LIMITED' | 'DRIVER_SAFETY_RESTRICTED' | 'BLOCKED_BY_POLICY' | 'ANDROID_PERMISSION_REQUIRED' | 'APP_UNAVAILABLE' | 'UNSUPPORTED';
export type ApplicationPermissionState = 'GRANTED' | 'REQUIRED' | 'DENIED' | 'UNKNOWN';
export type ApplicationAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'UNRESOLVED';
export type DriverSafetyMode = 'NORMAL' | 'RESTRICTED';

export type ApplicationAccessEntry = {
  packageName: string;
  appName: string;
  iconUri?: string;
  enabled: boolean;
  sensitive?: boolean;
  allowedActions: ApplicationAction[];
  restrictedActions: ApplicationAction[];
  safetyClass: ApplicationSafetyClass;
  permissionState: ApplicationPermissionState;
  availability: ApplicationAvailability;
  state: ApplicationAccessState;
};

export type ApplicationAccessProfile = {
  schemaVersion: 1;
  driverSafetyMode: DriverSafetyMode;
  entries: ApplicationAccessEntry[];
};

export type ApplicationPolicyDecision = {
  result: 'ALLOW' | 'DENY_USER' | 'DENY_POLICY' | 'DENY_DRIVER_SAFETY' | 'PERMISSION_REQUIRED' | 'UNAVAILABLE' | 'CONFIRMATION_REQUIRED' | 'UNSUPPORTED';
  reason: string;
  app: string;
  action: ApplicationAction;
  requiresConfirmation: boolean;
};

export const defaultApplicationAccessProfile = (): ApplicationAccessProfile => ({
  schemaVersion: 1,
  driverSafetyMode: 'NORMAL',
  entries: [],
});
