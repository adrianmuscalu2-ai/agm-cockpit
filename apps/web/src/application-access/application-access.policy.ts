import {
  applicationActions,
  type ApplicationAccessEntry,
  type ApplicationAction,
  type ApplicationAvailability,
  type ApplicationPermissionState,
  type ApplicationPolicyDecision,
  type ApplicationSafetyClass,
  type DriverSafetyMode,
} from './application-access.types';

const confirmationActions = new Set<ApplicationAction>(['SEND_CONTENT', 'START_CALL', 'SHARE_CONTENT']);
const restrictedWhileDriving = new Set<ApplicationAction>([
  'OPEN_APP', 'BRING_TO_FOREGROUND', 'OPEN_DEEP_LINK', 'READ_ALLOWED_CONTENT', 'COMPOSE_CONTENT',
  'SEND_CONTENT', 'SEARCH', 'QUERY_STATUS',
]);
const hardBlockTerms = /bank|finance|financial|crypto|wallet|exchange|password|1password|bitwarden|authenticator|2fa|credential|secret|recovery|bancar|revolut|paypal|n26|wise|sparkasse|ingdiba|comdirect|commerz|credit|health|medical|patient|sanatate|gesund|securefolder/i;
const gameTerms = /game|gaming|casino|poker/i;

export function classifyApplication(appName: string, packageName: string): ApplicationSafetyClass {
  const value = `${appName} ${packageName}`;
  if (hardBlockTerms.test(value)) return 'HARD_BLOCKED';
  if (gameTerms.test(value)) return 'GAME';
  if (/maps|waze|tomtom|navigation|nav/i.test(value)) return 'NAVIGATION';
  if (/spotify|music|podcast|player|radio|media/i.test(value)) return 'MEDIA';
  if (/phone|dialer|messenger|whatsapp|signal|telegram|mail|gmail|contact/i.test(value)) return 'COMMUNICATION';
  return 'GENERAL';
}

export function defaultAllowedActions(safetyClass: ApplicationSafetyClass): ApplicationAction[] {
  if (safetyClass === 'HARD_BLOCKED' || safetyClass === 'GAME') return [];
  if (safetyClass === 'NAVIGATION') return ['OPEN_APP', 'BRING_TO_FOREGROUND', 'OPEN_DEEP_LINK', 'NAVIGATE_TO_DESTINATION'];
  if (safetyClass === 'MEDIA') return ['OPEN_APP', 'BRING_TO_FOREGROUND', 'MEDIA_PLAY', 'MEDIA_PAUSE', 'MEDIA_NEXT', 'MEDIA_PREVIOUS', 'QUERY_STATUS'];
  if (safetyClass === 'COMMUNICATION') return ['OPEN_APP', 'BRING_TO_FOREGROUND', 'OPEN_CONTACT', 'COMPOSE_CONTENT', 'START_CALL'];
  return ['OPEN_APP', 'BRING_TO_FOREGROUND'];
}

export function discoveredApplication(app: { appName: string; packageName: string; iconUri?: string; availability?: ApplicationAvailability }): ApplicationAccessEntry {
  const safetyClass = classifyApplication(app.appName, app.packageName);
  const blocked = safetyClass === 'HARD_BLOCKED';
  return {
    packageName: app.packageName,
    appName: app.appName,
    ...(app.iconUri ? { iconUri: app.iconUri } : {}),
    enabled: false,
    allowedActions: [],
    restrictedActions: defaultAllowedActions(safetyClass),
    safetyClass,
    permissionState: 'UNKNOWN',
    availability: app.availability ?? 'AVAILABLE',
    state: blocked ? 'BLOCKED_BY_POLICY' : 'OFF',
  };
}

export function normalizeEntry(value: Partial<ApplicationAccessEntry>): ApplicationAccessEntry {
  const appName = typeof value.appName === 'string' ? value.appName.trim().slice(0, 160) : '';
  const packageName = typeof value.packageName === 'string' ? value.packageName.trim().slice(0, 240) : '';
  const safetyClass = value.sensitive === true ? 'HARD_BLOCKED' : classifyApplication(appName, packageName);
  const allowed = Array.isArray(value.allowedActions) ? value.allowedActions.filter((item): item is ApplicationAction => applicationActions.includes(item as ApplicationAction)) : [];
  const restricted = Array.isArray(value.restrictedActions) ? value.restrictedActions.filter((item): item is ApplicationAction => applicationActions.includes(item as ApplicationAction)) : defaultAllowedActions(safetyClass);
  const hardBlocked = safetyClass === 'HARD_BLOCKED';
  const enabled = !hardBlocked && value.enabled === true;
  const availability: ApplicationAvailability = value.availability === 'UNAVAILABLE' || value.availability === 'UNRESOLVED' ? value.availability : 'AVAILABLE';
  const permissionState: ApplicationPermissionState = value.permissionState === 'GRANTED' || value.permissionState === 'REQUIRED' || value.permissionState === 'DENIED' ? value.permissionState : 'UNKNOWN';
  return {
    packageName, appName, sensitive:value.sensitive===true, ...(typeof value.iconUri === 'string' && value.iconUri ? { iconUri: (/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(value.iconUri) && value.iconUri.length <= 50000 ? value.iconUri : '') } : {}),
    enabled, allowedActions: hardBlocked ? [] : [...new Set(allowed)], restrictedActions: [...new Set(restricted)], safetyClass,
    permissionState, availability,
    state: hardBlocked ? 'BLOCKED_BY_POLICY' : availability === 'UNAVAILABLE' ? 'APP_UNAVAILABLE' : enabled ? 'ON' : 'OFF',
  };
}

export function evaluateApplicationAction(
  entry: ApplicationAccessEntry | undefined,
  action: ApplicationAction,
  context: { driverSafetyMode?: DriverSafetyMode; androidPermission?: boolean; confirmationSatisfied?: boolean } = {},
): ApplicationPolicyDecision {
  const app = entry?.packageName ?? 'unknown';
  const requiresConfirmation = confirmationActions.has(action);
  if (!entry || !entry.appName || !entry.packageName) return decision('UNSUPPORTED', 'APPLICATION_IDENTITY_UNRESOLVED', app, action, requiresConfirmation);
  if (entry.sensitive === true || classifyApplication(entry.appName, entry.packageName) === 'HARD_BLOCKED' || entry.safetyClass === 'HARD_BLOCKED') return decision('DENY_POLICY', 'HARD_BLOCKED_SENSITIVE_APPLICATION', app, action, requiresConfirmation);
  if (entry.availability !== 'AVAILABLE') return decision('UNAVAILABLE', entry.availability === 'UNRESOLVED' ? 'APPLICATION_IDENTITY_UNRESOLVED' : 'APPLICATION_NOT_INSTALLED', app, action, requiresConfirmation);
  if (!entry.enabled) return decision('DENY_USER', 'PROFILE_ACCESS_NOT_ENABLED', app, action, requiresConfirmation);
  if (!entry.allowedActions.includes(action)) return decision('DENY_USER', 'CAPABILITY_NOT_GRANTED', app, action, requiresConfirmation);
  if (context.driverSafetyMode === 'RESTRICTED' && (entry.safetyClass === 'GAME' || restrictedWhileDriving.has(action))) {
    return decision('DENY_DRIVER_SAFETY', 'DRIVER_SAFETY_RESTRICTED', app, action, requiresConfirmation);
  }
  if (context.androidPermission === false || entry.permissionState === 'DENIED' || entry.permissionState === 'REQUIRED') {
    return decision('PERMISSION_REQUIRED', 'ANDROID_PERMISSION_REQUIRED', app, action, requiresConfirmation);
  }
  if (requiresConfirmation && !context.confirmationSatisfied) return decision('CONFIRMATION_REQUIRED', 'EXISTING_CONFIRMATION_RULE_REQUIRED', app, action, true);
  return decision('ALLOW', 'PROFILE_POLICY_ANDROID_CAPABILITY_ALLOWED', app, action, false);
}

function decision(result: ApplicationPolicyDecision['result'], reason: string, app: string, action: ApplicationAction, requiresConfirmation: boolean): ApplicationPolicyDecision {
  return { result, reason, app, action, requiresConfirmation };
}
