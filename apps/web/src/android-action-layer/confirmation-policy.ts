import type { AndroidActionKind, AndroidActionResolution } from './android-action.contract';

const policy: Record<AndroidActionKind, AndroidActionResolution['confirmation']> = {
  READ_CONTEXT: 'NONE',
  ASSISTANT: 'USER_COMMAND',
  NAVIGATION: 'USER_COMMAND',
  DIAL: 'ANDROID_TARGET',
  OPEN_APP: 'USER_COMMAND',
  CALENDAR: 'ANDROID_TARGET',
  REMINDER: 'ANDROID_TARGET',
  ALARM: 'ANDROID_TARGET',
  SHARE: 'AGM_REQUIRED',
  EMAIL_DRAFT: 'ANDROID_TARGET',
  MESSENGER_CHAT: 'ANDROID_TARGET',
  SETTINGS: 'USER_COMMAND',
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
