import { Capacitor } from '@capacitor/core';
import { createAndroidHandoffAdapter } from './android-handoff.adapter';
import { createBrowserHandoffAdapter } from './browser-handoff.adapter';
import type { EmailHandoffRequest, HandoffPort, ShareHandoffRequest } from './handoff.port';

export function selectHandoffPort(
  native = Capacitor.isNativePlatform(),
  browser: HandoffPort = createBrowserHandoffAdapter(),
  android: HandoffPort = createAndroidHandoffAdapter(),
) {
  return native ? android : browser;
}

export async function openEmailComposer(
  recipient: string,
  subject: string,
  body: string,
  attachments: NonNullable<EmailHandoffRequest['attachments']> = [],
) {
  await selectHandoffPort().composeEmail({ recipient, subject, body, attachments });
}

export async function openControlledShare(
  subject: string,
  body: string,
  attachments: NonNullable<ShareHandoffRequest['attachments']> = [],
) {
  await selectHandoffPort().share({ subject, body, attachments });
}

