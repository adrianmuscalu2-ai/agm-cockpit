export const MAX_MAIL_ATTACHMENTS = 5;
export const MAX_MAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_MAIL_ATTACHMENTS_TOTAL_BYTES = 20 * 1024 * 1024;

export type MailAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  base64: string;
};

export type MailAttachmentValidation =
  | { ok: true }
  | { ok: false; reason: 'too-many' | 'file-too-large' | 'total-too-large' | 'empty-file' };

export function validateMailAttachments(attachments: readonly Pick<MailAttachment, 'size'>[]): MailAttachmentValidation {
  if (attachments.length > MAX_MAIL_ATTACHMENTS) return { ok: false, reason: 'too-many' };
  if (attachments.some((attachment) => attachment.size <= 0)) return { ok: false, reason: 'empty-file' };
  if (attachments.some((attachment) => attachment.size > MAX_MAIL_ATTACHMENT_BYTES)) {
    return { ok: false, reason: 'file-too-large' };
  }
  const total = attachments.reduce((sum, attachment) => sum + attachment.size, 0);
  return total > MAX_MAIL_ATTACHMENTS_TOTAL_BYTES ? { ok: false, reason: 'total-too-large' } : { ok: true };
}

export async function filesToMailAttachments(files: readonly File[]): Promise<MailAttachment[]> {
  return Promise.all(files.map(async (file) => ({
    id: crypto.randomUUID?.() ?? `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name || 'attachment',
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    base64: await fileToBase64(file),
  })));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ATTACHMENT_READ_FAILED'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}

export function formatAttachmentBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
