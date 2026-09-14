import type { AndroidActionKind, AndroidActionResolution } from './android-action.contract';

const policy: Record<AndroidActionKind, AndroidActionResolution['confirmation']> = {
  READ_CONTEXT: 'NONE',
  ASSISTANT: 'USER_COMMAND',
  NAVIGATION: 'USER_COMMAND',
  DIAL: 'ANDROID_TARGET',
  CALENDAR: 'ANDROID_TARGET',
  SHARE: 'AGM_REQUIRED',
  EMAIL_DRAFT: 'ANDROID_TARGET',
};

export function confirmationFor(action: AndroidActionKind) {
  return policy[action];
}

export const androidActionSafetyBoundary = {
  autoSendEmail: false,
  directPhoneCall: false,
  directCalendarWrite: false,
  arbitraryUiAutomation: false,
  accessibilityService: false,
  finalExternalCommit: 'ANDROID_TARGET_REQUIRES_USER_ACTION',
} as const;
