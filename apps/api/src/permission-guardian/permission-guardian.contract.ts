export const PERMISSION_GUARDIAN_CONTRACT = {
  version: 'permission-guardian.v1',
  eventType: 'PERMISSION_GUARDIAN_EVALUATION',
  findingEventType: 'PERMISSION_GUARDIAN_CONTROL_FINDING',
  actorId: 'agm.guardian.permissions',
  allowed: {
    ANDROID_ASSISTANT: ['NOT_REQUIRED'],
    ANDROID_ASSISTANT_SETTINGS: ['NOT_REQUIRED'],
    NAVIGATION: ['NOT_REQUIRED'],
    DIALER: ['NOT_REQUIRED'],
    OPEN_APP: ['NOT_REQUIRED'],
    CALENDAR_INSERT: ['NOT_REQUIRED'],
    REMINDER: ['NOT_REQUIRED'],
    ALARM: ['NOT_REQUIRED'],
    SHARE: ['NOT_REQUIRED'],
    EMAIL_DRAFT: ['NOT_REQUIRED'],
    MESSENGER_CHAT: ['NOT_REQUIRED'],
    MICROPHONE_STT: ['android.permission.RECORD_AUDIO'],
    CAMERA_CAPTURE: ['android.permission.CAMERA'],
    CONTACT_LOOKUP: ['android.permission.READ_CONTACTS'],
    GMAIL_READONLY: ['https://www.googleapis.com/auth/gmail.readonly'],
    GMAIL_SEND: ['https://www.googleapis.com/auth/gmail.send'],
    AGM_SESSION_REFRESH: ['agm.auth.refresh'],
    INTENT_ROUTER: ['NOT_REQUIRED'],
    DRIVER_VOICE_MODE: ['NOT_REQUIRED'],
    ANDROID_PERMISSION_PROTOCOL: ['NOT_REQUIRED'],
    AGM_AUTHORIZATION_PROTOCOL: ['NOT_REQUIRED'],
    GMAIL_AUTHORIZATION_PROTOCOL: ['NOT_REQUIRED'],
  } as const,
} as const;

export type GuardianAuthorityState = 'AUTHORIZED' | 'DENIED' | 'REVOKED' | 'NOT_REQUIRED' | 'NOT_PROVEN' | 'UNAVAILABLE';
export type GuardianDecision = 'APPROVED' | 'DENIED' | 'NOT_PROVEN';
