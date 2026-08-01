import type { HandoffPort } from './handoff.port';

export function createBrowserHandoffAdapter(): HandoffPort {
  return {
    platform: 'browser',
    async composeEmail({ recipient, subject, body, attachments = [] }) {
      if (attachments.length > 0) {
        throw Object.assign(new Error('Email attachments require the Android app'), { code: 'EMAIL_ATTACHMENTS_UNAVAILABLE' });
      }
      const query = new URLSearchParams({ subject, body });
      window.location.href = `mailto:${encodeURIComponent(recipient)}?${query.toString()}`;
    },
    async share({ subject, body, attachments = [] }) {
      const files = attachments.map((attachment) => new File(
        [Uint8Array.from(atob(attachment.base64), (character) => character.charCodeAt(0))],
        attachment.name,
        { type: attachment.mimeType },
      ));
      const data: ShareData = { title: subject, text: body, files };
      if (!navigator.share || (files.length > 0 && (!navigator.canShare || !navigator.canShare(data)))) {
        throw Object.assign(new Error('Share is unavailable'), { code: 'SHARE_UNAVAILABLE' });
      }
      await navigator.share(data);
    },
  };
}

